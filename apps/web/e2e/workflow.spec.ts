// End-to-end workflow tests on synthetic data (run `npm run build` first).
import { expect, test, type Page } from '@playwright/test';

async function asUser(page: Page, name: RegExp) {
  const sel = page.getByTestId('user-switch');
  const value = await sel.locator('option', { hasText: name }).getAttribute('value');
  await sel.selectOption(value!);
}

function seg(page: Page, testId: string, label: string) {
  return page.getByTestId(testId).getByRole('button', { name: label, exact: true });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('new exam: endometrioma -> BD1, O-RADS 2, confirm, sign, report shows versions', async ({ page }) => {
  await page.getByTestId('new-exam').click();
  await expect(page).toHaveURL(/\/exams\/[0-9a-f-]+\/patient$/);
  // No patient identifiers in the URL.
  expect(page.url()).not.toMatch(/SYN-|TEST/);

  await page.getByTestId('patient-dob').fill('1992-03-14');
  await seg(page, 'menopause', 'Premenopausal').click();
  await page.getByTestId('next-step').click();

  await seg(page, 'fluid', 'None').click();
  await page.getByTestId('next-step').click();

  await page.getByTestId('add-right').click();
  const d = page.getByTestId('lesion-diameters').locator('input');
  await d.nth(0).fill('45'); await d.nth(1).fill('40'); await d.nth(2).fill('38');
  await seg(page, 'echogenicity', 'Ground-glass').click();
  await seg(page, 'colour-score', '2 · Minimal').click();

  // Live risk panel updates before saving.
  const panel = page.getByTestId('risk-panel');
  await expect(panel.getByTestId('bd-R1')).toContainText('BD1 applies');
  await expect(panel).toContainText('O-RADS 2');
  await expect(page.getByTestId('red-flags')).toHaveCount(0);

  await page.getByTestId('next-step').click(); // -> risk
  await page.getByTestId('next-step').click(); // -> review

  // A sonographer cannot confirm.
  await page.getByTestId('confirm-R1').click();
  await expect(page.getByTestId('action-error')).toContainText('Only a reporting clinician');

  await asUser(page, /Dr Kim Level II/);
  await page.getByTestId('confirm-R1').click();
  await expect(page.getByTestId('decision-status-R1')).toContainText('Confirmed');
  await page.getByTestId('sign').click();
  await expect(page.getByRole('link', { name: 'View report' })).toBeVisible();

  await page.getByTestId('step-report').click();
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('IOTA modified benign descriptor: BD1 applies');
  await expect(report).toContainText('Rules file version');
  await expect(report).toContainText('Report version 1');
  await expect(report).toContainText('DRAFT RULES - NOT SIGNED OFF');

  // Signed exams are read-only; amendment creates version 2.
  await page.getByTestId('amend-reason').fill('Corrected lesion size');
  await page.getByTestId('amend').click();
  await expect(page).toHaveURL(/\/patient$/);
  await page.getByTestId('step-report').click();
  await expect(page.getByTestId('report-text')).toContainText('AMENDED REPORT - version 2');
});

test('red flag gate: malignant demo case cannot be signed until flags acknowledged and referrer called', async ({ page }) => {
  await page.getByTestId('seed-demo').click();
  await page.getByRole('link', { name: 'TEST, Charlie' }).click();
  await expect(page.getByTestId('risk-panel').getByTestId('sr-R1')).toContainText('malignant');
  await expect(page.getByTestId('risk-panel').getByTestId('sr-R1')).toContainText('M: M2, M4, M5');
  await expect(page.getByTestId('red-flags')).toBeVisible();

  await asUser(page, /Dr Lee Level III/);
  await page.getByTestId('step-review').click();

  // ADNEX not entered: no suggestion, so assign by descriptors with a reason.
  await page.getByTestId('assign-R1-5').click();
  await page.getByTestId('override-reason-R1').fill('Descriptor-based: irregular solid with ascites and omental cake');
  await page.getByTestId('override-R1').click();
  await expect(page.getByTestId('decision-status-R1')).toContainText('Overridden to O-RADS 5');

  await expect(page.getByTestId('sign')).toBeDisabled();
  await expect(page.getByTestId('blockers')).toContainText('Red flag not acknowledged');

  for (const key of ['R1:M-FEATURE', 'EXAM:ASCITES']) await page.getByTestId(`ack-${key}`).click();
  await expect(page.getByTestId('blockers')).toContainText('Log the referrer phone call');
  await page.getByTestId('call-recipient').fill('Dr Referrer (GP)');
  await page.getByTestId('log-call').click();
  await expect(page.getByTestId('call-logged')).toContainText('Dr Referrer (GP)');

  await page.getByTestId('sign').click();
  await page.getByTestId('step-report').click();
  const report = page.getByTestId('report-text');
  await expect(report).toContainText('O-RADS 5 - High');
  await expect(report).toContainText('Reason: Descriptor-based');
  await expect(report).toContainText('to Dr Referrer (GP)');
  await expect(page.getByTestId('audit-log')).toContainText('override-category');
});

test('override 3 -> 4 needs a reason; ovaries not visualised; follow-up list', async ({ page }) => {
  await page.getByTestId('seed-demo').click();
  await page.getByRole('link', { name: 'TEST, Echo' }).click();
  await page.getByTestId('step-report').click();
  await expect(page.getByTestId('report-text')).toContainText('RIGHT OVARY: not visualised');
  await expect(page.getByTestId('report-text')).not.toContainText('RIGHT OVARY: normal');

  await page.goto('/');
  await page.getByRole('link', { name: 'TEST, Delta' }).click();
  await page.getByTestId('step-lesions').click();
  await expect(page.getByTestId('risk-panel')).toContainText('Required — enter the result');
  await page.getByTestId('add-adnex').click();
  for (const [k, v] of [['total', '4'], ['benign', '96'], ['borderline', '2'], ['stage1', '1'], ['stage2', '0.5'], ['metastatic', '0.5']]) {
    await page.getByTestId(`adnex-${k}`).fill(v!);
  }
  await expect(page.getByTestId('risk-panel').getByTestId('risk-R1')).toContainText('O-RADS 3');

  await asUser(page, /Dr Lee Level III/);
  await page.getByTestId('step-review').click();
  await page.getByTestId('assign-R1-4').click();
  await page.getByTestId('override-R1').click();
  await expect(page.getByTestId('action-error')).toContainText('override reason is mandatory');
  await page.getByTestId('override-reason-R1').fill('Level III: suspicious septal flow');
  await page.getByTestId('override-R1').click();
  await expect(page.getByTestId('decision-status-R1')).toContainText('Overridden to O-RADS 4');

  await page.getByTestId('step-report').click();
  await expect(page.getByTestId('report-text')).toContainText('engine suggested O-RADS 3 - Low risk');

  await page.getByTestId('step-follow-up').click();
  await page.getByTestId('fu-due').fill('2027-01-15');
  await page.getByTestId('fu-reason').fill('Gynaecology review outcome');
  await page.getByTestId('fu-add').click();
  await page.goto('/follow-up');
  await expect(page.getByTestId('follow-up-table')).toContainText('Gynaecology review outcome');
});

test('validation: solid component larger than lesion blocks the result', async ({ page }) => {
  await page.getByTestId('new-exam').click();
  await seg(page, 'menopause', 'Premenopausal').click();
  await page.getByTestId('step-lesions').click();
  await page.getByTestId('add-left').click();
  await seg(page, 'tumour-type', 'Unilocular-solid').click();
  const d = page.getByTestId('lesion-diameters').locator('input');
  await d.nth(0).fill('50'); await d.nth(1).fill('40'); await d.nth(2).fill('30');
  const s = page.getByTestId('solid-diameters').locator('input');
  await s.nth(0).fill('60'); await s.nth(1).fill('20'); await s.nth(2).fill('20');
  const card = page.getByTestId('risk-panel').getByTestId('risk-L1');
  await expect(card).toContainText('larger than the lesion');
  await expect(card).toContainText('No result until the errors above are corrected');
});
