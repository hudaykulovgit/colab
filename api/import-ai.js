const { generateObject } = require('ai');
const { google } = require('@ai-sdk/google');
const { z } = require('zod');
const { upsertContract } = require('../lib/contracts');
const { generateSchedule, addMonths } = require('../lib/schedule');

// Calls Google's Generative AI API directly (not via Vercel AI Gateway) using
// a free Google AI Studio key (GOOGLE_GENERATIVE_AI_API_KEY) -- no Vercel
// billing/credit-card requirement, and Gemini's free tier covers this
// workload comfortably.
const MODEL = 'gemini-3.5-flash';

// Keeps a single request's token usage (and cost) bounded. Large sheets
// should be split into multiple uploads.
const MAX_ROWS = 400;

const ContractSchema = z.object({
  assetType: z.enum(['Car', 'Commercial vehicle', 'Real estate', 'Other']),
  assetName: z.string().min(1),
  borrower: z.string().min(1),
  lender: z.string().nullable(),
  licensePlate: z.string().nullable(),
  vehicleYear: z.number().int().nullable(),
  mileage: z.number().nullable(),
  assetPrice: z.number().nullable(),
  contractDate: z.string().describe('ISO date YYYY-MM-DD'),
  firstDueDate: z.string().nullable().describe('ISO date YYYY-MM-DD, or null if not stated'),
  termMonths: z.number().int().positive(),
  principal: z.number().positive(),
  interestRate: z.number().min(0).describe('Total interest/markup as a percentage, e.g. 25 for 25%'),
  notes: z.string().nullable(),
});

const ResultSchema = z.object({
  contracts: z.array(ContractSchema),
  issues: z.array(z.string()).describe('One entry per row that was skipped or is ambiguous, explaining why'),
});

const SYSTEM_PROMPT = `You normalize messy spreadsheet exports of car/asset loan contracts into clean structured records.

The input is an array of raw rows from an uploaded Excel/CSV file. Column headers and languages vary (English, Russian, Uzbek) and may be inconsistent between rows or missing entirely. Your job:

1. Identify which rows represent an actual loan contract (skip blank rows, section headers repeated mid-sheet, subtotal/summary rows, or anything that isn't a real contract record).
2. For each genuine contract row, extract and normalize the fields to the given schema:
   - Dates must become ISO format (YYYY-MM-DD). Excel serial date numbers should be converted correctly.
   - interestRate is the total markup/interest as a percentage over the full term (not an annual rate) unless the sheet clearly states otherwise.
   - assetType must be exactly one of: Car, Commercial vehicle, Real estate, Other -- pick the closest match.
   - If firstDueDate isn't stated, return null (the caller will default it to one month after contractDate).
   - If lender, licensePlate, vehicleYear, mileage, assetPrice, or notes aren't present, return null for that field -- do not invent values.
3. A row is only skippable/omittable if you cannot determine assetName, borrower, principal, termMonths, or contractDate with reasonable confidence. When you skip or aren't fully confident about a row, add a one-line explanation to "issues" (reference the row's borrower/asset name or row position).
4. Never fabricate financial figures. If a number is genuinely ambiguous, prefer omitting the row over guessing.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body && req.body.rows;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Expected { rows: [...] } — parsed Excel/CSV rows as objects.' });
    }
    if (rows.length === 0) {
      return res.status(200).json({ imported: 0, issues: [] });
    }
    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ error: `This file has ${rows.length} rows; please split it into batches of ${MAX_ROWS} or fewer.` });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return res.status(503).json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY is not configured yet.' });
    }

    const { object } = await generateObject({
      model: google(MODEL),
      schema: ResultSchema,
      system: SYSTEM_PROMPT,
      prompt: `Here are the raw rows (as JSON) from the uploaded file:\n\n${JSON.stringify(rows)}`,
    });

    let imported = 0;
    const errors = [];
    let seq = 0;
    for (const contract of object.contracts) {
      seq += 1;
      try {
        const firstDueDate = contract.firstDueDate || addMonths(contract.contractDate, 1);
        const total = +(contract.principal * (1 + contract.interestRate / 100)).toFixed(2);
        const id = `AF-AI-${Date.now()}-${seq}`;
        await upsertContract({
          id,
          sourceSheet: 'AI import',
          sourceTitle: 'AI import',
          ...contract,
          firstDueDate,
          totalReceivable: total,
          paymentLog: [],
          schedule: generateSchedule(firstDueDate, contract.termMonths, total),
        });
        imported += 1;
      } catch (err) {
        errors.push(`${contract.assetName || 'row ' + seq}: ${err.message}`);
      }
    }

    return res.status(200).json({ imported, issues: [...object.issues, ...errors] });
  } catch (err) {
    console.error(err);
    const status = err.statusCode === 402 ? 402 : err.statusCode === 429 ? 429 : 500;
    return res.status(status).json({ error: err.message });
  }
};
