Client Summary – Admin Dashboard & Automation System

The client is looking for a full-stack system / admin dashboard that automates and manages incoming service requests with routing, pricing, and dealer assignment logic.

Core Concept:

A system that:

Receives requests via WhatsApp, Telegram, and Outlook/email
Determines whether the request is within service coverage (domestic/international logic)
If service is unavailable, automatically forwards the request to external dealers
Applies a client-defined markup on dealer pricing before responding to the customer
Data Sources:
Existing Excel files (can be migrated to database if needed for performance/scalability):
Country/region + routing rules (postal code-based logic)
Route pricing table
Dealer/vendor lists

Client is open to:

Continuing with Excel integration, or
Migrating to a database-based architecture depending on performance and scalability needs
Required Admin Panel Features:

Authentication & Access

Username/password login
Session-based authentication management

Offers Management

Preset offers list
Each entry includes: customer, route, price, language, channel, response text
Actions: Approve / Reject / Edit

Transaction & Request Tracking

Full history of all requests
Filters: date, channel, language, status
Detailed view per request

Dealer / Partner Management

Add / edit / delete dealers
Active/inactive toggle
Update margin rates

Route Pricing System

Add / edit / delete route-based pricing
Real-time updates required

Approval Workflow Settings

Modes:
Auto-send
Low confidence only
Manual approval for all
Changes apply instantly

Analytics Dashboard

Daily/weekly request volume
Channel distribution (WhatsApp / Telegram / Email)
Language distribution
Average response time
Approval rate metrics
Automation Logic:
Incoming request is analyzed
If service is not available in defined coverage:
→ Request is automatically forwarded to relevant dealers
Dealer responses are used to generate customer quote
System applies predefined markup before sending final response




WhatsApp and Telegram examples
1)
Yükleme yeri : D-45478 Mülheim
Tonaj : 3.500,- kg
(optima , mega , yada kapalı kasa olması tercih sebebi. Yük 2.85 cm yükseklikte.

Gümrük : Erenköy –Gün antrepo
komple kara aracı istaniyor
2)
Loading location:
• FCA Le Havre FR-76 , France

Delivery location – I need 2 separated quotes for :
• Le Havre, France -76 to Poti, Georgia
• Le Havre, France – 76 to Ashgabat, Turkmenistan

Cargo details:
• Description: Wheel Cleaner equipment
• Dimensions : 13.0 m (L) × 3.40 m (W) × approx. 1.20–1.50 m (H)
• Weight: 14,000 kg
• Type: Oversized cargo (Category II)
• Loading type: Break bulk
3)
Pick up - Çanakkale, TR
Delivery - Almaty
Ceramic panels on pallets
Total gross – 20 tn
Value – 50 000 USD
FTL
4)
Karelya Cumhuriyeti, Petrozavodsk (Rusya) - Konya (Türkiye)
Yük: kereste
Ağırlık: 22 ton
yandan yükleme
Solros LLC

Sample customer requests:

1)
Yükleme Adresi:
WEILER ABRASIVES D.O.O.

TITOVA CESTA 60
2000 MARIBOR, SLOVENIA

Pick up possible every day between 8.00 – 13.30. Goods are NON-STACKABLE. Goods are not dangerous.
Gümrük: Gemlik
Boşaltma: Borusan Sundurma



If the content of the received quote is illegible, please submit the following template. (Fields marked with * are required.)
Loading Information
*Loading City / Country:
*Unloading City / Country
*Loading Date:
Load Type:
Vehicle Type:
*Weight:


rota_fiyat.xls shows the countries and prices we serve. We prepared the countries and cities again in the file avrupa_posta_kodu_ilk_2_hane_lojistik.xlsx to provide more detail. TEDARİKÇİ LİSTELER (2).xlsx is the list of dealers our vendors serve.
folder that include these excel files: /excel_files


Hi, I have a few questions I gathered while working on the system

1. When a request is outside your service coverage
Should we send it to one vendor or multiple vendors?
if multiple, should we contact all available vendors that serve these locations or limit it to a certain number or how exactly?

2. For vendor responses
Should we wait for all responses before generating a quote?
Or proceed with the first response we receive?
If multiple vendors respond, how should we choose?

3. Regarding vendor coverage
In the sheet, vendors are listed per country but without specific coverage details how we can know that?

Thanks


1. When a service is outside our coverage area, we must notify all providers serving that region.
Let’s mark the providers’ status as “active” or “inactive.” The notification should be sent to those marked as “active.”

2. Let’s set a time limit for responses. We should be able to adjust this time limit via the panel. For example, let’s set a 30-minute waiting period after the request is sent to suppliers. At the end of this period, we will proceed with the supplier offering the lowest bid. Meanwhile, a specific profit margin will be added to the price quoted by the supplier. This can also be adjusted via the panel.

3. I’ll discuss this matter and let you know
3. It will be based solely on the country. Suppliers will be selected based on the country specified in the order.


Hi, I have one more clarification regarding how we communicate with vendors
When we send requests to vendors, which channel should we use?

Email
WhatsApp
Or both

also, should each vendor have a preferred communication method, or do you want the system to always use a specific channel?
also since vendors may receive multiple requests from us at the same time especially for services company don’t cover, we want to ensure responses are clearly matched to the correct request

for tracking vendor responses, I’m planning to include a unique order ID in every message sent to vendors

each vendor will be asked to include this ID in their reply so we can correctly match responses to the original request

Please let me know if you’re okay with this approach

@geniusmonarch

Hi, We accept orders via email, WhatsApp, and Telegram.
Suppliers may prefer different communication methods. Can we specify these through the dashboard?
For example, it would be great if we could choose options like "Email only" or "Email and WhatsApp."

A unique order number makes a lot of sense.
But what happens if a supplier forgets to include the order number and sends the quote anyway?
Do you mean that when we add each supplier to the dashboard, we can assign a select box for their preferred communication channels (e.g., Email only, or Email + WhatsApp)?

Regarding the order ID part:
In case multiple orders were sent to the supplier and they haven’t responded yet, then they reply later after receiving several offers the response will be linked to the latest offer that was sent to them if him didn’t add the is in measage
didnt add the id in message
User Avatar
@geniusmonarch

Yes, it would make more sense if we could assign a checkbox. What do you think? Do you have a better idea?
I think using checkboxes for selecting the preferred channels would be the most suitable option.


