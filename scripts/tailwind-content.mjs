import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * solvimon-ui directories, relative to its `dist`, that no SDK entry bundles: desk, PDF and editor
 * components.
 *
 * Tailwind scans solvimon-ui's `dist` for class names, and every class it finds lands in the
 * stylesheet every entry adopts, so these are left out of the scan. Should an entry ever bundle a
 * file from one of them, its classes would be missing from that stylesheet, which is why the build
 * fails on it (`bundledUnscannedUiFiles`).
 */
export const UI_DIRS_NOT_SCANNED = [
    'components/invoices/EInvoiceStatusChip',
    'components/invoices/InvoiceGrid',
    'components/invoices/InvoiceHeaderBillingEntityDetail',
    'components/invoices/InvoicePaymentSummary',
    'components/invoices/InvoicePreviewCard',
    'components/invoices/TaxNotes',
    'components/pdf',
    'components/providers/TeleportProvider',
    'components/shared/ActionButtons',
    'components/shared/BillingCurrency',
    'components/shared/Breadcrumbs',
    'components/shared/ButtonGroup',
    'components/shared/CalloutRow',
    'components/shared/Collapsible',
    'components/shared/Container',
    'components/shared/Country',
    'components/shared/Coupon',
    'components/shared/Details',
    'components/shared/Editor',
    'components/shared/EntityDetailsCard',
    'components/shared/Link',
    'components/shared/MarkdownEditor',
    'components/shared/NotificationToast',
    'components/shared/PageGrid',
    'components/shared/Pagination',
    'components/shared/PromotionCode',
    'components/shared/ScrollableTableContainer',
    'components/shared/SummaryDetailsList',
    'components/shared/SummaryGrid',
    'components/shared/Toast',
    'components/shared/Toaster',
    'components/shared/UserChip',
    'dynamic-variables',
    'party-details',
];

/**
 * The module ids, of those a build bundled, that sit in a directory Tailwind does not scan.
 *
 * Matched on `/dist/<directory>/` rather than the package name, so that a solvimon-ui linked from
 * a local checkout, whose ids are its real path, is checked too.
 *
 * @param {string[]} moduleIds
 * @returns {string[]}
 */
export function bundledUnscannedUiFiles(moduleIds) {
    return moduleIds.filter((id) => {
        const path = id.replace(/\\/g, '/');
        return UI_DIRS_NOT_SCANNED.some((dir) => path.includes(`/dist/${dir}/`));
    });
}

/**
 * The listed directories `uiDist` does not have. A directory solvimon-ui renamed or moved is
 * scanned again under its new name, which costs every entry its classes without failing anything.
 *
 * @param {string} uiDist - solvimon-ui's `dist` directory
 * @returns {string[]}
 */
export function missingUiDirs(uiDist) {
    return UI_DIRS_NOT_SCANNED.filter((dir) => !existsSync(join(uiDist, dir)));
}
