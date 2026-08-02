import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbConfigured, sql } from '@/lib/db';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const feedbackSchema = z.object({
  planRunId: z.string().uuid().optional(),
  farmPlotId: z.string().uuid().optional(),
  reviewerRole: z.enum(['farmer', 'recoftc', 'officer', 'developer', 'expert']),
  understandableScore: z.number().int().min(1).max(5).optional(),
  agronomicScore: z.number().int().min(1).max(5).optional(),
  priceYieldScore: z.number().int().min(1).max(5).optional(),
  riskMatchScore: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * The farmer-facing feedback form is deferred until a field visit, so this endpoint has no
 * caller — which left an unauthenticated DB write open in production for a feature nobody could
 * reach. Off unless FIELD_FEEDBACK_ENABLED is set.
 *
 * A flag rather than an auth check on purpose. The eventual form is for farmers and officers
 * standing in a plot, so bolting the admin cookie on now would only have to be undone, and
 * whatever scheme it ends up with should be a decision made when the form is designed — not a
 * placeholder that quietly becomes permanent.
 */
const enabled = () => process.env.FIELD_FEEDBACK_ENABLED === '1';

export async function POST(request: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: 'field feedback is not enabled on this deployment' }, { status: 404 });
  }
  // Writes to the DB — cap per-IP to prevent feedback-table spam.
  const limited = rateLimited(request, 'field-feedback', 12, 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid feedback', issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ status: 'queued_locally', message: 'DATABASE_URL is not configured; keep this feedback in field notes for import.' });
  }
  const db = sql();
  const row = parsed.data;
  const result = await db`
    INSERT INTO field_feedback (
      plan_run_id, farm_plot_id, reviewer_role, understandable_score,
      agronomic_score, price_yield_score, risk_match_score, notes
    )
    VALUES (
      ${row.planRunId ?? null}, ${row.farmPlotId ?? null}, ${row.reviewerRole},
      ${row.understandableScore ?? null}, ${row.agronomicScore ?? null},
      ${row.priceYieldScore ?? null}, ${row.riskMatchScore ?? null}, ${row.notes ?? null}
    )
    RETURNING id
  `;
  return NextResponse.json({ status: 'saved', id: result[0]?.id });
}
