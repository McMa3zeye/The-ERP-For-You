export const PAGE_HELP = {
  dashboard: {
    title: 'Dashboard',
    overview:
      'A live overview of what matters today: sales, orders, inventory risk, and operational signals. Use it as your daily command center.',
    howItWorks: [
      'Use tabs to switch between overview and deeper breakdowns.',
      'Charts are interactive: hover to inspect values; click segments to filter in some widgets.',
      'Export buttons allow sharing (CSV/Excel/PDF where available).',
    ],
    bestPractice: [
      'Check low-stock + overdue invoices first.',
      'Use recent orders to jump into operational work.',
    ],
  },
  products: {
    title: 'Products',
    overview:
      'Create and manage your product catalog (finished goods, sub-assemblies, raw materials). This is the source of truth for pricing, costing, and production inputs.',
    howItWorks: [
      'Create products with type/category, pricing, and cost.',
      'Use search and filters to find items quickly.',
      'Open details to inspect attributes and linked activity.',
    ],
    bestPractice: [
      'Keep cost updated for accurate profitability.',
      'Use consistent categories for clean reporting.',
    ],
  },
  inventory: {
    title: 'Inventory',
    overview:
      'Track on-hand stock, reorder points, and inventory health. This powers low-stock alerts and availability checks.',
    howItWorks: [
      'Review stock by product/location.',
      'Adjust reorder points to match real demand.',
      'Use exports for cycle counts and reconciliation.',
    ],
    bestPractice: ['Do cycle counts on a schedule and reconcile differences quickly.'],
  },
  customers: {
    title: 'Customers',
    overview:
      'Store customer profiles, contacts, and sales history context. Customers connect to quotes, orders, invoices, and support.',
    howItWorks: [
      'Create customers and keep contact info accurate.',
      'Use the customer record as the starting point for new sales.',
    ],
    bestPractice: ['Use consistent company names and keep billing details current.'],
  },
  suppliers: {
    title: 'Suppliers',
    overview:
      'Manage supplier records, contacts, lead times, and purchasing context. Suppliers connect to purchase orders and materials.',
    howItWorks: ['Add suppliers, then create purchase orders tied to them.'],
    bestPractice: ['Track lead times to improve planning and reduce stockouts.'],
  },
  leads: {
    title: 'Leads',
    overview:
      'Capture and qualify potential deals before they become customers/orders. Track stage, value, and next actions.',
    howItWorks: ['Create leads, update pipeline stage, and convert into quotes when ready.'],
    bestPractice: ['Add next-step notes and keep stages up to date for forecasting.'],
  },
  quotes: {
    title: 'Quotes',
    overview:
      'Create quotes for customers, then convert accepted quotes into sales orders. Quotes help standardize pricing and approvals.',
    howItWorks: ['Build a quote, add line items, send to customer, then convert when accepted.'],
    bestPractice: ['Use quote validity dates and clear payment/lead time terms.'],
  },
  salesOrders: {
    title: 'Sales Orders',
    overview:
      'Sales Orders represent confirmed customer demand. They drive work orders, inventory reservations, shipping, and invoicing.',
    howItWorks: [
      'Create/confirm orders from quotes or directly.',
      'Update status as the order moves through production/shipping.',
    ],
    bestPractice: ['Keep statuses accurate—operations and reporting depend on it.'],
  },
  purchasing: {
    title: 'Purchasing',
    overview:
      'Manage purchase orders to suppliers and track incoming materials. Purchasing helps prevent stockouts and supports production planning.',
    howItWorks: ['Create purchase orders, receive items, and update inventory accordingly.'],
    bestPractice: ['Confirm supplier lead time before committing production dates.'],
  },
  invoicing: {
    title: 'Invoicing',
    overview:
      'Generate invoices, track due dates, and manage invoice statuses. Invoicing ties directly to payments and financial reporting.',
    howItWorks: ['Create invoice, send to customer, record payments, and close when paid.'],
    bestPractice: ['Set clear due dates and follow up on overdue invoices.'],
  },
  payments: {
    title: 'Payments',
    overview:
      'Record payments against invoices and track settlement methods. This improves cash visibility and reduces reconciliation errors.',
    howItWorks: ['Create a payment, link it to an invoice, and verify the remaining balance.'],
    bestPractice: ['Use consistent payment references for bank reconciliation.'],
  },
  workOrders: {
    title: 'Work Orders',
    overview:
      'Plan and execute production work. Work orders track status, resources, and progress toward delivery.',
    howItWorks: ['Create work orders from sales demand, start work, then complete/close.'],
    bestPractice: ['Record blockers early—planning and delivery dates depend on it.'],
  },
  manufacturing: {
    title: 'Manufacturing (BOM)',
    overview:
      'Define Bills of Materials (BOM) so the system knows what components are required to build products.',
    howItWorks: ['Create BOMs for finished goods and sub-assemblies, then use them in production.'],
    bestPractice: ['Keep BOMs versioned and review after design changes.'],
  },
  warehousing: {
    title: 'Warehousing',
    overview:
      'Organize storage locations, manage stock placement, and support picking/packing flows.',
    howItWorks: ['Use location data to speed up picking and reduce errors.'],
    bestPractice: ['Standardize location naming for consistency.'],
  },
  quality: {
    title: 'Quality',
    overview:
      'Run inspections and capture pass/fail outcomes so you can spot trends, reduce defects, and protect customer satisfaction.',
    howItWorks: [
      'Create an inspection (incoming / in-process / final).',
      'Link it to the relevant product and reference document if applicable.',
      'Record inspected quantity and pass/fail results.',
      'Add notes for defects and next steps (rework, scrap, supplier follow-up).',
    ],
    bestPractice: [
      'Use consistent defect notes so reporting can identify common causes.',
      'Inspect early (incoming) to avoid wasting production time on bad materials.',
    ],
  },
  shipping: {
    title: 'Shipping',
    overview:
      'Create shipments, track delivery status, and (optionally) store tracking numbers. Shipping closes the loop on order fulfillment.',
    howItWorks: ['Create shipment for an order, update statuses, and confirm delivery.'],
    bestPractice: ['Capture tracking numbers for customer support and dispute handling.'],
  },
  returns: {
    title: 'Returns & RMA',
    overview:
      'Handle returned goods, reasons, and dispositions (restock, scrap, repair). Returns affect inventory and customer satisfaction.',
    howItWorks: ['Create an RMA, record items/condition, and complete disposition.'],
    bestPractice: ['Track reasons to reduce future defects and returns.'],
  },
  expenses: {
    title: 'Expenses',
    overview:
      'Track business expenses for profitability, budgeting, and accounting integration.',
    howItWorks: ['Create expense records with category/date/amount and export when needed.'],
    bestPractice: ['Use consistent categories for clean reporting.'],
  },
  projects: {
    title: 'Projects',
    overview:
      'Track internal or customer projects, costs, and progress. Useful for job costing and delivery coordination.',
    howItWorks: ['Create projects, attach tasks/notes, and link relevant orders/expenses.'],
    bestPractice: ['Keep timelines and scope notes updated.'],
  },
  supportTickets: {
    title: 'Support Tickets',
    overview:
      'Manage customer issues, track status, and ensure timely resolution. Support feeds product quality and customer retention.',
    howItWorks: ['Log tickets, assign ownership, update status, and close with notes.'],
    bestPractice: ['Use categories to identify common problems.'],
  },
  timeAttendance: {
    title: 'Time & Attendance',
    overview:
      'Track employee time entries for payroll and productivity. Accurate time data is foundational for payroll processing.',
    howItWorks: ['Record time entries, review approvals (if used), and export for payroll.'],
    bestPractice: ['Review weekly to catch issues early.'],
  },
  hr: {
    title: 'Human Resources',
    overview:
      'Manage employee records, roles, and HR-related information needed for payroll and compliance.',
    howItWorks: ['Create/update employee profiles, track employment details.'],
    bestPractice: ['Keep emergency/contact info and pay terms accurate.'],
  },
  assets: {
    title: 'Assets & Maintenance',
    overview:
      'Track company assets, maintenance schedules, and service history. Reduces downtime and supports cost control.',
    howItWorks: ['Create assets, log maintenance, and plan next service dates.'],
    bestPractice: ['Set maintenance intervals based on usage, not just calendar time.'],
  },
  admin: {
    title: 'Admin & Security',
    overview:
      'Manage users, roles, permissions, audit logs, and system security settings.',
    howItWorks: [
      'Create users and assign roles.',
      'Use roles to control access per module/action.',
      'Use audit logs to review sensitive changes.',
    ],
    bestPractice: ['Give minimum permissions required for the job (least privilege).'],
  },
  reporting: {
    title: 'Reporting',
    overview:
      'View, save, and export reports for operations and finance. Reporting turns data into decisions.',
    howItWorks: ['Filter reports by date/module and export to share with stakeholders.'],
    bestPractice: ['Standardize weekly/monthly reporting cadences.'],
  },
  accounting: {
    title: 'Accounting',
    overview:
      'Manage chart of accounts, journal entries, and financial statements. This is your financial backbone.',
    howItWorks: [
      'Initialize chart of accounts, then record journal entries.',
      'Use trial balance / balance sheet views to validate totals.',
    ],
    bestPractice: ['Lock periods after close to protect historical reporting.'],
  },
  productionPlanning: {
    title: 'Production Planning',
    overview:
      'Plan work across time, resources, and work orders. Improves delivery reliability and capacity planning.',
    howItWorks: ['Create schedules, assign resources, and review conflicts.'],
    bestPractice: ['Update plan daily to reflect reality and prevent surprises.'],
  },
  documents: {
    title: 'Document Management',
    overview:
      'Store and version important documents (drawings, specs, contracts) and link them to records.',
    howItWorks: ['Upload documents, add versions, and link to the relevant module/entity.'],
    bestPractice: ['Use clear naming conventions and categories.'],
  },
  payroll: {
    title: 'Payroll',
    overview:
      'Manage payroll periods and generate payslips. Payroll relies on accurate employee and time data.',
    howItWorks: ['Open a period, generate payslips, review, approve, then mark as paid/closed.'],
    bestPractice: ['Run payroll in a controlled process with approvals.'],
  },
  pos: {
    title: 'Point of Sale (POS)',
    overview:
      'Sell quickly at the counter, track sessions, and record transactions. Great for walk-in sales.',
    howItWorks: ['Open a session, add items to cart, take payment, and close session with reconciliation.'],
    bestPractice: ['Close sessions daily and investigate cash differences immediately.'],
  },
  tooling: {
    title: 'Tooling & Consumables',
    overview:
      'Track tools, maintenance logs, and consumable stock. Helps prevent downtime and missing materials.',
    howItWorks: ['Manage tool list, log maintenance, restock consumables, record usage.'],
    bestPractice: ['Set reorder points for consumables you never want to run out of.'],
  },
  portal: {
    title: 'Customer/Supplier Portal',
    overview:
      'Manage portal users and messages for external collaboration. Keep communication attached to the right parties.',
    howItWorks: ['Create portal users and send/receive messages.'],
    bestPractice: ['Use the portal for official updates and keep internal notes separate.'],
  },
  settings: {
    title: 'Settings',
    overview:
      'Configure how the ERP feels and behaves: company info, security rules, notifications, backups, and appearance (themes).',
    howItWorks: [
      'Use Setup Wizard for first-time configuration.',
      'Use Appearance to switch themes and density.',
      'Use Backup to create/download/restore database backups.',
    ],
    bestPractice: ['Set backups + retention before onboarding users.'],
  },
}

export function getHelpForKey(key) {
  return PAGE_HELP[key] || { title: 'Help', overview: 'No help content found for this page yet.' }
}

