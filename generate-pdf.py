from fpdf import FPDF
import sys

class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font('ArialUnicode', '', 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'Logistics Dashboard -- Business User Guide', align='L', new_x='LMARGIN', new_y='TOP')
        self.cell(0, 10, f'Page {self.page_no()}', align='R', new_x='LMARGIN', new_y='NEXT')

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-15)
        self.set_font('ArialUnicode', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, 'Confidential -- For Internal Use Only', align='C')

    def chapter_title(self, title):
        self.set_font('ArialUnicode', 'B', 16)
        self.set_text_color(28, 25, 23)
        self.cell(0, 12, title, new_x='LMARGIN', new_y='NEXT')
        self.set_draw_color(194, 65, 12)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def section_title(self, title):
        self.set_font('ArialUnicode', 'B', 13)
        self.set_text_color(28, 25, 23)
        self.cell(0, 10, title, new_x='LMARGIN', new_y='NEXT')
        self.ln(2)

    def sub_title(self, title):
        self.set_font('ArialUnicode', 'B', 11)
        self.set_text_color(50, 50, 50)
        self.cell(0, 8, title, new_x='LMARGIN', new_y='NEXT')

    def body_text(self, text):
        self.set_font('ArialUnicode', '', 10)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet_point(self, text, level=0):
        indent = 5 * level
        self.set_x(15 + indent)
        self.set_font('ArialUnicode', '', 10)
        self.set_text_color(60, 60, 60)
        self.cell(5, 5.5, '*', new_x='RIGHT', new_y='TOP')
        self.multi_cell(0, 5.5, f'  {text}')

    def note_box(self, text):
        self.set_fill_color(255, 247, 237)
        self.set_draw_color(194, 65, 12)
        self.set_font('ArialUnicode', '', 9)
        self.set_text_color(80, 60, 40)
        self.multi_cell(0, 5, f'Note: {text}', border=1, fill=True)
        self.ln(3)

    def warning_box(self, text):
        self.set_fill_color(254, 242, 242)
        self.set_draw_color(185, 28, 28)
        self.set_font('ArialUnicode', 'B', 9)
        self.set_text_color(120, 40, 40)
        self.multi_cell(0, 5, f'IMPORTANT: {text}', border=1, fill=True)
        self.ln(3)

    def info_box(self, text):
        self.set_fill_color(239, 246, 255)
        self.set_draw_color(29, 78, 216)
        self.set_font('ArialUnicode', '', 9)
        self.set_text_color(30, 60, 120)
        self.multi_cell(0, 5, text, border=1, fill=True)
        self.ln(3)

    def table_row(self, cols, widths, bold_first=False, header=False):
        if header:
            self.set_fill_color(245, 245, 245)
            self.set_font('ArialUnicode', 'B', 9)
            self.set_text_color(40, 40, 40)
            fill = True
        else:
            self.set_font('ArialUnicode', '' if not bold_first else 'B', 9)
            self.set_text_color(60, 60, 60)
            fill = False
        
        for i, (col, w) in enumerate(zip(cols, widths)):
            if i == 0 and bold_first and not header:
                self.set_font('ArialUnicode', 'B', 9)
            align = 'L' if i == 0 else 'C'
            self.cell(w, 7, str(col), border=1, fill=fill, align=align, new_x='RIGHT', new_y='TOP')
            if i == 0 and bold_first and not header:
                self.set_font('ArialUnicode', '', 9)
        self.ln()

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_font('ArialUnicode', '', '/Library/Fonts/Arial Unicode.ttf')
pdf.add_font('ArialUnicode', 'B', '/Library/Fonts/Arial Unicode.ttf')
pdf.add_font('ArialUnicode', 'I', '/Library/Fonts/Arial Unicode.ttf')
pdf.add_font('ArialUnicode', 'BI', '/Library/Fonts/Arial Unicode.ttf')
pdf.add_page()

# Cover Page
pdf.set_font('ArialUnicode', 'B', 28)
pdf.set_text_color(28, 25, 23)
pdf.ln(60)
pdf.cell(0, 20, 'Logistics Dashboard', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.set_font('ArialUnicode', '', 14)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 10, 'Business User Guide', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.ln(20)
pdf.set_font('ArialUnicode', '', 10)
pdf.set_text_color(120, 120, 120)
pdf.cell(0, 8, 'A comprehensive guide for business users', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 8, 'covering system operations, workflows, and daily tasks', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.ln(30)
pdf.set_draw_color(194, 65, 12)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.ln(5)
pdf.set_font('ArialUnicode', 'I', 9)
pdf.cell(0, 8, 'Confidential -- For Internal Use Only', align='C', new_x='LMARGIN', new_y='NEXT')

# Table of Contents
pdf.add_page()
pdf.chapter_title('Table of Contents')
toc_items = [
    '1. System Overview',
    '2. Home Dashboard',
    '3. Quotes',
    '4. RFQ Management',
    '5. Vendors',
    '6. Route Pricing',
    '7. System Settings',
    '8. Import Data',
    '9. Unmatched Replies',
    '10. Key Business Rules',
    '11. Testing Environment',
]
for item in toc_items:
    pdf.set_font('ArialUnicode', '', 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 8, item, new_x='LMARGIN', new_y='NEXT')

# Chapter 1: System Overview
pdf.add_page()
pdf.chapter_title('1. System Overview')
pdf.body_text('The Logistics Dashboard is an automated quoting system that receives shipment requests from customers via WhatsApp, Telegram, or Email, automatically calculates prices or requests quotes from vendors, and manages the entire process from request to final price delivery.')

pdf.section_title('How It Works (The Big Picture)')
steps = [
    'Customer sends message via WhatsApp, Telegram, or Email',
    'System reads and understands the message using AI',
    'Looks up internal pricing for the requested route',
    'If price found: sends quote to customer automatically',
    'If no price: creates RFQ and sends to all relevant vendors',
    'Vendors reply with their prices',
    'System picks the lowest price and adds your margin',
    'Admin reviews and approves (or rejects)',
    'Customer receives the final price'
]
for step in steps:
    pdf.bullet_point(step)
pdf.ln(3)

pdf.section_title('What This Means for You')
pdf.bullet_point('Customers get instant responses when routes are covered')
pdf.bullet_point('Vendors compete for uncovered routes via automatic RFQ')
pdf.bullet_point('You control everything through approval or rejection')
pdf.bullet_point('No manual data entry for incoming requests')
pdf.ln(5)

pdf.note_box('The system handles the heavy lifting. Your job is to review, approve, and manage exceptions.')

# Chapter 2: Home Dashboard
pdf.add_page()
pdf.chapter_title('2. Home Dashboard')
pdf.body_text('When you log in, the Home page gives you a complete picture of your business at a glance.')

pdf.section_title('Key Metrics (Top Row)')
metrics = [
    ('Revenue', 'Total value of all approved and sent quotes'),
    ('Active Vendors', 'Number of vendors ready to receive RFQs'),
    ('Open RFQs', 'RFQs waiting for vendor responses'),
    ('Unmatched Replies', 'Vendor replies needing manual matching'),
    ('System Mode', 'Current automation setting (Auto / Manual)')
]
for name, desc in metrics:
    pdf.set_font('ArialUnicode', 'B', 10)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(50, 6, name, new_x='RIGHT', new_y='TOP')
    pdf.set_font('ArialUnicode', '', 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f'-- {desc}', new_x='LMARGIN', new_y='NEXT')
pdf.ln(3)

pdf.section_title('Status Row')
pdf.body_text('Below the key metrics, you will find detailed statistics:')
status_items = [
    'Total Requests: All customer messages received',
    'Total Quotes: All quotes created in the system',
    'Pending: Quotes waiting for your action',
    'Approved: Quotes you have approved',
    'Rejected: Quotes you have rejected',
    'Sent: Quotes successfully delivered to the customer',
    'Ready to Send: Auto-approved but not yet delivered',
    'Avg Response Time: How fast you process quotes',
    'Approval Rate: Percentage of quotes you approve'
]
for item in status_items:
    pdf.bullet_point(item)
pdf.ln(3)

pdf.section_title('Coverage Breakdown')
pdf.body_text('Shows how requests are handled across your business:')
pdf.bullet_point('Internal Pricing: Auto-priced from your route database')
pdf.bullet_point('RFQ: Sent to vendors for competitive bidding')
pdf.bullet_point('No Coverage: No pricing available and no vendors found')
pdf.bullet_point('Data Request: Missing information from the customer')
pdf.ln(5)

pdf.section_title('Top Routes')
pdf.body_text('Your most popular shipping lanes. Use this to identify which routes need better vendor coverage or internal pricing.')

pdf.section_title('Recent Pending Quotes')
pdf.body_text('Quick access to quotes that need your attention right now. Click any quote to review and take action.')

# Chapter 3: Quotes
pdf.add_page()
pdf.chapter_title('3. Quotes')
pdf.body_text('The Quotes page is your main workspace. This is where you review, approve, and reject customer requests.')

pdf.section_title('Understanding Quote Cards')
pdf.body_text('Each quote card is color-coded by status for instant recognition:')

pdf.set_fill_color(255, 251, 235)
pdf.set_draw_color(161, 98, 7)
pdf.cell(30, 7, 'Amber', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Pending -- You need to approve or reject', new_x='LMARGIN', new_y='NEXT')

pdf.set_fill_color(240, 253, 244)
pdf.set_draw_color(21, 128, 61)
pdf.cell(30, 7, 'Green', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Approved -- Sent to customer', new_x='LMARGIN', new_y='NEXT')

pdf.set_fill_color(254, 242, 242)
pdf.set_draw_color(185, 28, 28)
pdf.cell(30, 7, 'Red', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Rejected -- Customer was notified', new_x='LMARGIN', new_y='NEXT')

pdf.set_fill_color(239, 246, 255)
pdf.set_draw_color(29, 78, 216)
pdf.cell(30, 7, 'Blue', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Ready to Send -- Auto-approved, waiting to deliver', new_x='LMARGIN', new_y='NEXT')

pdf.set_fill_color(240, 253, 244)
pdf.set_draw_color(21, 128, 61)
pdf.cell(30, 7, 'Green', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Sent -- Successfully delivered to customer', new_x='LMARGIN', new_y='NEXT')
pdf.ln(5)

pdf.section_title('Card Layout')
pdf.body_text('Each card shows all essential information in a clear layout:')
pdf.bullet_point('Quote ID and status badges')
pdf.bullet_point('Customer name and shipping route')
pdf.bullet_point('Weight, postal codes, language, and channel')
pdf.bullet_point('Coverage type: Internal, RFQ, No Coverage, or Data Request')
pdf.bullet_point('Price and date on the right side')
pdf.ln(3)

pdf.section_title('Filters')
pdf.body_text('Use filters to find specific quotes quickly:')
filter_items = [
    'Status: Pending, Approved, Rejected, Ready to Send, Sent',
    'Channel: WhatsApp, Telegram, Email',
    'Language: Filters by customer language',
    'Date Range: From/To dates for time-based searches',
    'Search: Find by customer name, route, or currency'
]
for item in filter_items:
    pdf.bullet_point(item)
pdf.ln(3)

pdf.section_title('Quote Detail Page')
pdf.body_text('Click any quote to see the full details and take action.')
pdf.sub_title('Information Panel')
pdf.body_text('Shows all quote details including customer info, origin/destination, weight, cargo type, pricing breakdown, language, channel, and system mode at time of creation.')
pdf.sub_title('RFQ Details (if applicable)')
pdf.body_text('If this quote went through the RFQ process, you will see all vendors who received the request, their individual responses and prices, and which vendor had the lowest bid (marked as Selected). You can also manually select a different vendor if needed.')
pdf.sub_title('Review Decision Panel')
pdf.body_text('For pending quotes, this is where you take action:')
pdf.bullet_point('Approve: Send the price to the customer. You can revise the price, add notes, and customize the customer message.')
pdf.bullet_point('Reject: Decline the request with a reason. The customer receives a rejection message.')
pdf.sub_title('Create RFQ from Quote')
pdf.body_text('If a quote has no internal pricing and no RFQ was created automatically, you can manually create an RFQ directly from the quote detail page. Select the target country and the system will send the RFQ to all active vendors covering that country.')

# Chapter 4: RFQ Management
pdf.add_page()
pdf.chapter_title('4. RFQ Management')
pdf.body_text('RFQ (Request for Quote) is the process of asking vendors for prices when you do not have internal pricing for a route.')

pdf.section_title('How RFQs Work Automatically')
rfq_steps = [
    'Customer requests a quote for a route with no internal price',
    'System finds all active vendors covering the destination country',
    'Sends RFQ to every vendor via their preferred channel (Email or WhatsApp)',
    'Vendors reply with their prices',
    'After the waiting period expires, system picks the lowest bid',
    'Admin reviews and approves or rejects'
]
for step in rfq_steps:
    pdf.bullet_point(step)
pdf.ln(3)

pdf.section_title('RFQ Status')
pdf.body_text('Each RFQ has one of three statuses:')

pdf.set_fill_color(239, 246, 255)
pdf.set_draw_color(29, 78, 216)
pdf.cell(35, 7, 'Open', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Waiting for vendor responses', new_x='LMARGIN', new_y='NEXT')

pdf.set_fill_color(240, 253, 244)
pdf.set_draw_color(21, 128, 61)
pdf.cell(35, 7, 'Responded', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Vendors have replied, ready for review', new_x='LMARGIN', new_y='NEXT')

pdf.set_fill_color(248, 248, 248)
pdf.set_draw_color(168, 162, 158)
pdf.cell(35, 7, 'Closed', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, '  Process completed', new_x='LMARGIN', new_y='NEXT')
pdf.ln(5)

pdf.note_box('RFQs are fully automated. You do not need to manually send them or chase vendors. Just monitor the status and review results when ready.')

# Chapter 5: Vendors
pdf.add_page()
pdf.chapter_title('5. Vendors')
pdf.body_text('Vendors are your partners who provide prices for routes you do not cover internally. Keeping your vendor list up-to-date is critical for the RFQ process.')

pdf.section_title('Adding a Vendor')
pdf.body_text('Go to Master Data -> Vendors and click Add Vendor. Fill in the following fields:')

pdf.set_font('ArialUnicode', 'B', 9)
pdf.set_text_color(40, 40, 40)
pdf.cell(50, 6, 'Field', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.cell(25, 6, 'Required', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.cell(0, 6, 'Description', border=1, fill=True, align='C', new_x='LMARGIN', new_y='NEXT')

vendor_fields = [
    ('Name', 'Yes', 'Company or contact name'),
    ('Country Coverage', 'Yes', 'Which country they serve'),
    ('City', 'No', 'Specific city if applicable'),
    ('Priority Ranking', 'No', 'Lower number = higher priority'),
    ('Use Custom Margin', 'No', 'Special markup for this vendor'),
    ('Margin Rate (%)', 'No', 'Only if custom margin is checked'),
    ('Email', 'No', 'For email-based RFQs'),
    ('Phone', 'No', 'For WhatsApp-based RFQs'),
    ('Preferred Channels', 'No', 'Email and/or WhatsApp'),
    ('Active', 'Yes', 'Whether they receive RFQs'),
    ('Notes', 'No', 'Special agreements or info')
]
for field, req, desc in vendor_fields:
    pdf.table_row([field, req, desc], [50, 25, 115])
pdf.ln(3)

pdf.section_title('Vendor-Specific Margins')
pdf.body_text('Normally, all vendor prices get the global margin from Settings. But you can set a custom margin per vendor.')
pdf.body_text('Example:')
pdf.bullet_point('Vendor A has custom margin 15%: $100 bid becomes $115 final')
pdf.bullet_point('Vendor B uses global margin 20%: $90 bid becomes $108 final')
pdf.ln(3)
pdf.note_box('Use custom margins for vendors with special agreements or different commission structures.')

# Chapter 6: Route Pricing
pdf.add_page()
pdf.chapter_title('6. Route Pricing')
pdf.body_text('Route Pricing is your internal price database. When a customer requests a quote for a route that exists here, they get an instant automatic response without waiting for vendors.')

pdf.section_title('Adding Route Pricing')
pdf.body_text('Go to Master Data -> Route Pricing and click Add Pricing.')

pdf.set_font('ArialUnicode', 'B', 9)
pdf.set_text_color(40, 40, 40)
pdf.cell(50, 6, 'Field', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.cell(25, 6, 'Required', border=1, fill=True, align='C', new_x='RIGHT', new_y='TOP')
pdf.cell(0, 6, 'Description', border=1, fill=True, align='C', new_x='LMARGIN', new_y='NEXT')

pricing_fields = [
    ('Origin Region', 'Yes', 'Where shipment starts'),
    ('Destination Region', 'Yes', 'Where shipment ends'),
    ('Base Price', 'Yes', 'Your cost for this route'),
    ('Markup (%)', 'Yes', 'Your profit margin'),
    ('Currency', 'Yes', 'EUR, USD, TRY, etc.'),
    ('Active', 'Yes', 'Whether this price is live')
]
for field, req, desc in pricing_fields:
    pdf.table_row([field, req, desc], [50, 25, 115])
pdf.ln(5)

pdf.section_title('Price Calculation')
pdf.set_font('ArialUnicode', 'B', 11)
pdf.set_text_color(40, 40, 40)
pdf.cell(0, 8, 'Final Price = Base Price x (1 + Markup / 100)', new_x='LMARGIN', new_y='NEXT')
pdf.ln(2)
pdf.set_font('ArialUnicode', '', 10)
pdf.set_text_color(80, 80, 80)
pdf.cell(0, 6, 'Example: Base $1,000 + Markup 20% = Final Price $1,200', new_x='LMARGIN', new_y='NEXT')
pdf.ln(5)

pdf.note_box('The customer receives the final price instantly. No waiting, no manual calculation.')

pdf.section_title('Importing Pricing')
pdf.body_text('For bulk updates, use the Import Data feature. Download the example Excel file to see the exact format required.')

# Chapter 7: System Settings
pdf.add_page()
pdf.chapter_title('7. System Settings')
pdf.body_text('Go to Master Data -> System Settings to configure how the system behaves.')

pdf.section_title('Master Logic Toggle')
pdf.body_text('This is the most important setting. It controls when customers get automatic responses:')

pdf.ln(2)
pdf.set_fill_color(245, 245, 245)
pdf.set_draw_color(200, 200, 200)
pdf.set_font('ArialUnicode', 'B', 10)
pdf.set_text_color(28, 25, 23)
pdf.cell(0, 7, '  Auto Send Mode', border=1, fill=True, new_x='LMARGIN', new_y='NEXT')
pdf.set_font('ArialUnicode', '', 9)
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 5.5, '    -- Customer gets instant price for covered routes', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- RFQ prices go directly to customer after vendors reply', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Fastest mode, least admin work', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Best for: Established routes with trusted pricing', new_x='LMARGIN', new_y='NEXT')
pdf.ln(4)

pdf.set_fill_color(255, 251, 235)
pdf.set_draw_color(161, 98, 7)
pdf.set_font('ArialUnicode', 'B', 10)
pdf.set_text_color(28, 25, 23)
pdf.cell(0, 7, '  Manual Approval Mode', border=1, fill=True, new_x='LMARGIN', new_y='NEXT')
pdf.set_font('ArialUnicode', '', 9)
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 5.5, '    -- Everything stays pending for admin review', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Even RFQ results wait for your approval', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Maximum control over every quote', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Best for: New business, testing, or high-value shipments', new_x='LMARGIN', new_y='NEXT')
pdf.ln(4)

pdf.set_fill_color(239, 246, 255)
pdf.set_draw_color(29, 78, 216)
pdf.set_font('ArialUnicode', 'B', 10)
pdf.set_text_color(28, 25, 23)
pdf.cell(0, 7, '  Low Confidence Only', border=1, fill=True, new_x='LMARGIN', new_y='NEXT')
pdf.set_font('ArialUnicode', '', 9)
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 5.5, '    -- Auto-sends for high-confidence parsing results', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Keeps low-confidence results pending for review', new_x='LMARGIN', new_y='NEXT')
pdf.cell(0, 5.5, '    -- Balanced approach between speed and control', new_x='LMARGIN', new_y='NEXT')
pdf.ln(4)

pdf.section_title('Waiting Period')
pdf.body_text('How long the system waits for vendor responses before closing an RFQ:')
pdf.bullet_point('1 minute: For testing only')
pdf.bullet_point('30 minutes: Good for urgent requests')
pdf.bullet_point('2 hours: Standard business practice')
pdf.bullet_point('24 hours: For vendors in different time zones')
pdf.ln(3)

pdf.section_title('Global Markup (%)')
pdf.body_text('The default profit margin applied to all vendor prices. You can override this per vendor using the custom margin feature.')

# Chapter 8: Import Data
pdf.add_page()
pdf.chapter_title('8. Import Data')
pdf.body_text('Instead of adding data one by one, you can bulk import from Excel files. This saves significant time when setting up or updating the system.')

pdf.section_title('Supported Import Types')
pdf.bullet_point('Postal Codes: Maps postal code prefixes to regions')
pdf.bullet_point('Route Pricing: Bulk import shipping prices')
pdf.bullet_point('Vendors: Bulk import vendor contacts')
pdf.ln(3)

pdf.section_title('How to Import')
import_steps = [
    'Go to Master Data -> Import Data',
    'Select the import type from the dropdown',
    'Click Download Example XLSX to see the required format',
    'Fill your data in the same column structure',
    'Upload the file using the file picker',
    'System shows how many records were inserted and skipped'
]
for step in import_steps:
    pdf.bullet_point(step)
pdf.ln(3)

pdf.note_box('Always download the example file first. Using the wrong format will cause imports to fail or skip records.')

pdf.section_title('Important Notes')
pdf.bullet_point('Vendors: Each sheet in the Excel file represents one country')
pdf.bullet_point('Route Pricing: First 2 rows are headers, data starts from row 3')
pdf.bullet_point('Postal Codes: Supports ranges like 01-09 which expands automatically')
pdf.ln(5)

# Chapter 9: Unmatched Replies
pdf.add_page()
pdf.chapter_title('9. Unmatched Replies')
pdf.body_text('Sometimes vendors reply but forget to include the RFQ reference number. These replies land in Unmatched Replies for manual processing.')

pdf.section_title('Why Replies Become Unmatched')
pdf.bullet_point('Vendor forgot to include RFQ reference number')
pdf.bullet_point('Vendor replied from a different email or phone number')
pdf.bullet_point('Multiple open RFQs exist for the same vendor')
pdf.bullet_point('System could not extract a price from the reply text')
pdf.ln(3)

pdf.section_title('How to Handle')

pdf.sub_title('1. Attach to RFQ')
pdf.body_text('Use this when the reply contains a valid price and you know which RFQ it belongs to. Click Attach to RFQ, enter the reference number (e.g., RFQ-20260504-001), and the system matches the vendor and records the price.')

pdf.sub_title('2. Mark as Resolved')
pdf.body_text('Use this when you have handled the reply outside the system. It removes the item from the active list.')

pdf.sub_title('3. Mark as Ignored')
pdf.body_text('Use this for spam, test messages, or irrelevant replies. It removes the item from the active list.')
pdf.ln(3)

pdf.note_box('Check Unmatched Replies daily. Every unmatched reply is a potential lost vendor bid.')

# Chapter 10: Key Business Rules
pdf.add_page()
pdf.chapter_title('10. Key Business Rules')

pdf.section_title('When Customers Get Messages')
pdf.body_text('Customers are ONLY notified when:')
pdf.bullet_point('Route has internal pricing AND auto-send is enabled')
pdf.bullet_point('Admin approves a quote')
pdf.bullet_point('Admin rejects a quote')
pdf.ln(3)

pdf.body_text('Customers are NEVER notified when:')
pdf.bullet_point('Quote is pending (unless auto-send mode)')
pdf.bullet_point('RFQ is waiting for vendor responses')
pdf.bullet_point('Data is missing from the request')
pdf.ln(5)

pdf.section_title('Price Calculation')
pdf.sub_title('Internal Pricing:')
pdf.set_font('ArialUnicode', 'B', 11)
pdf.cell(0, 6, 'Final Price = Base Price x (1 + Markup / 100)', new_x='LMARGIN', new_y='NEXT')
pdf.ln(2)

pdf.sub_title('Vendor Pricing:')
pdf.set_font('ArialUnicode', 'B', 11)
pdf.cell(0, 6, 'Final Price = Lowest Vendor Bid x (1 + Margin / 100)', new_x='LMARGIN', new_y='NEXT')
pdf.ln(5)

pdf.section_title('Vendor Selection')
pdf.bullet_point('ALL active vendors covering the destination country receive the RFQ')
pdf.bullet_point('There is no limit on vendor count')
pdf.bullet_point('System picks the LOWEST bid automatically')
pdf.bullet_point('Admin can revise the price before final approval')
pdf.bullet_point('Admin can also manually select a different vendor from the RFQ Details panel')
pdf.ln(5)

pdf.section_title('Oversize Loads')
pdf.body_text('If shipment weight exceeds the threshold (default 22 tons):')
pdf.bullet_point('Quote is automatically set to Pending')
pdf.bullet_point('Reason shows: Oversize Load')
pdf.bullet_point('Admin must review manually before sending')

# Chapter 11: Testing Environment
pdf.add_page()
pdf.chapter_title('11. Testing Environment')
pdf.body_text('Before going live, the system can be tested using the credentials and contact points below.')

pdf.section_title('Test Channels')

pdf.sub_title('WhatsApp')
pdf.body_text('Our test WhatsApp Business number is:')
pdf.set_font('ArialUnicode', 'B', 14)
pdf.set_text_color(194, 65, 12)
pdf.cell(0, 10, '+1 (555) 637-5901', new_x='LMARGIN', new_y='NEXT')
pdf.ln(2)
pdf.set_font('ArialUnicode', '', 10)
pdf.set_text_color(60, 60, 60)
pdf.body_text('This is the company number where customers send their shipment requests. You can send test messages to this number to see how the system parses and processes them.')

pdf.warning_box('If you want to use this test WhatsApp number to send quotes and receive vendor requests via WhatsApp, you MUST provide your list of phone numbers to the system administrator. The Meta Business Manager test number has a maximum limit of 3 registered numbers. Without adding your number to the allowed list, WhatsApp messages will fail.')

pdf.sub_title('Telegram')
pdf.body_text('Our test Telegram bot is:')
pdf.set_font('ArialUnicode', 'B', 14)
pdf.set_text_color(194, 65, 12)
pdf.cell(0, 10, '@adasdasdasdsaasdbot', new_x='LMARGIN', new_y='NEXT')
pdf.ln(2)
pdf.set_font('ArialUnicode', '', 10)
pdf.set_text_color(60, 60, 60)
pdf.body_text('Start a chat with this bot to send test shipment requests. The bot will respond just like a real customer channel.')

pdf.sub_title('Email')
pdf.body_text('Our test email address is:')
pdf.set_font('ArialUnicode', 'B', 14)
pdf.set_text_color(194, 65, 12)
pdf.cell(0, 10, 'ahmed.shoshan@outlook.com', new_x='LMARGIN', new_y='NEXT')
pdf.ln(2)
pdf.set_font('ArialUnicode', '', 10)
pdf.set_text_color(60, 60, 60)
pdf.body_text('Send test quote requests to this email address. The system will process them just like customer emails.')

pdf.section_title('How to Test')
test_steps = [
    'Send a test message to any of the channels above with a sample shipment request',
    'Include: origin city, destination city, weight, and cargo type',
    'Check the Quotes page to see if the system created a quote correctly',
    'If no internal pricing exists, manually create an RFQ from the quote detail page',
    'Wait for vendor responses or simulate a vendor reply',
    'Approve or reject the quote and verify the customer receives the response',
]
for step in test_steps:
    pdf.bullet_point(step)
pdf.ln(3)

pdf.info_box('All test messages are processed through the same pipeline as live messages. The only difference is the contact points. Make sure your vendor list and route pricing are configured before testing end-to-end.')

# Final page
pdf.add_page()
pdf.set_font('ArialUnicode', 'B', 18)
pdf.set_text_color(28, 25, 23)
pdf.ln(80)
pdf.cell(0, 15, 'Thank You', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.set_font('ArialUnicode', '', 11)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 10, 'For questions or support, contact your system administrator.', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.ln(20)
pdf.set_draw_color(194, 65, 12)
pdf.line(70, pdf.get_y(), 140, pdf.get_y())

# Save
output_path = '/Users/ahmed/Downloads/my-app/docs/Logistics-Dashboard-Business-Guide.pdf'
pdf.output(output_path)
print(f'PDF generated successfully: {output_path}')
print(f'Total pages: {pdf.page_no()}')
