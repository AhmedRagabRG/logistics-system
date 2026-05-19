export type DashboardLocale = 'en' | 'tr';

export const supportedLocales: DashboardLocale[] = ['en', 'tr'];
export const DEFAULT_LOCALE: DashboardLocale = 'tr';

export function isValidLocale(value: string): value is DashboardLocale {
  return supportedLocales.includes(value as DashboardLocale);
}

export type TranslationKey =
  // Layout / Navigation
  | 'app_title'
  | 'nav_home'
  | 'nav_quotes'
  | 'nav_rfqs'
  | 'nav_history'
  | 'nav_master_data'
  | 'nav_vendors'
  | 'nav_pricing'
  | 'nav_settings'
  | 'nav_admins'
  | 'nav_exchange_rates'
  | 'nav_import'
  | 'nav_countries'
  | 'nav_operations'
  | 'logout'
  | 'language'
  // Home / Analytics
  | 'dashboard_subtitle'
  | 'stat_total_requests'
  | 'stat_total_quotes'
  | 'stat_pending_quotes'
  | 'stat_approved_quotes'
  | 'stat_rejected_quotes'
  | 'stat_sent_quotes'
  | 'stat_avg_response'
  | 'stat_approval_rate'
  | 'channel_distribution'
  | 'language_distribution'
  | 'daily_volume'
  | 'date'
  | 'requests'
  | 'quotes'
  | 'no_data'
  | 'route_pricing_card'
  | 'route_pricing_desc'
  | 'vendors_card'
  | 'vendors_desc'
  | 'settings_card'
  | 'settings_desc'
  // Quotes
  | 'quotes_title'
  | 'quotes_count'
  | 'quotes_empty'
  | 'filter_status'
  | 'filter_channel'
  | 'filter_language'
  | 'filter_all'
  | 'status_pending'
  | 'status_approved'
  | 'status_rejected'
  | 'status_ready'
  | 'status_sent'
  | 'quote_detail_title'
  | 'customer'
  | 'origin_region'
  | 'destination_region'
  | 'origin_postal_code'
  | 'destination_postal_code'
  | 'currency'
  | 'weight'
  | 'base_price'
  | 'markup'
  | 'final_price'
  | 'language_label'
  | 'channel_label'
  | 'toggle_state'
  | 'processed_by'
  | 'review_reason'
  | 'response_text'
  | 'cargo_type'
  | 'original_message'
  | 'processed_at'
  | 'oversize_badge'
  | 'rfq_badge'
  | 'internal_pricing_badge'
  | 'price_pending'
  | 'na'
  // Review form
  | 'review_decision'
  | 'approve'
  | 'reject'
  | 'revised_price'
  | 'keep_current_price'
  | 'notes'
  | 'customer_response_text'
  | 'confirm_approval'
  | 'confirm_rejection'
  | 'rejection_reason'
  | 'rejection_reason_required'
  | 'approving'
  | 'rejecting'
  | 'network_error'
  | 'approve_failed'
  | 'reject_failed'
  // RFQ
  | 'rfq_title'
  | 'rfq_empty'
  // History
  | 'history_title'
  | 'history_export_csv'
  | 'event_type'
  | 'admin'
  | 'details'
  // Master Data
  | 'vendors_title'
  | 'vendors_add'
  | 'vendors_edit'
  | 'vendors_new'
  | 'vendor_name'
  | 'vendor_origin'
  | 'vendor_origin_placeholder'
  | 'vendor_select_country'
  | 'vendor_city'
  | 'vendor_city_placeholder'
  | 'vendor_authorized_person'
  | 'vendor_authorized_person_placeholder'
  | 'vendor_notes'
  | 'vendor_notes_placeholder'
  | 'vendor_priority'
  | 'vendor_priority_hint'
  | 'vendor_margin'
  | 'vendor_margin_hint'
  | 'vendor_active'
  | 'vendor_email'
  | 'vendor_phone'
  | 'vendor_telegram'
  | 'vendor_preferred_channels'
  | 'vendor_save'
  | 'vendor_update'
  | 'vendor_cancel'
  | 'vendor_delete_confirm'
  | 'vendor_delete'
  | 'pricing_title'
  | 'settings_title'
  | 'exchange_rates_title'
  // General
  | 'error_loading'
  | 'loading'
  | 'save'
  | 'cancel'
  | 'delete'
  | 'edit'
  | 'actions'
  | 'currency_try'
  // Import
  | 'import_title'
  | 'import_type'
  | 'import_file'
  | 'import_submit'
  | 'import_loading'
  | 'import_result'
  | 'import_records_inserted'
  | 'import_records_skipped'
  | 'import_error'
  | 'import_requirements'
  | 'import_expected_columns'
  | 'import_example_row'
  | 'import_sheet_note'
  | 'import_accepted_formats'
  | 'import_required'
  | 'import_optional'
  | 'import_col_iso'
  | 'import_col_prefix'
  | 'import_col_region'
  | 'import_col_origin'
  | 'import_col_destination'
  | 'import_col_price_export'
  | 'import_col_price_import'
  | 'import_col_currency'
  | 'import_col_company'
  | 'import_col_origin_city'
  | 'import_col_email'
  | 'import_col_phone'
  | 'import_col_notes'
  | 'import_option_postal_codes'
  | 'import_option_route_pricing'
  | 'import_option_vendors'
  | 'import_option_countries'
  // Pagination
  | 'page'
  | 'of'
  | 'records'
  | 'prev'
  | 'next'
  // Bulk actions / Search
  | 'search_placeholder'
  | 'delete_selected'
  | 'select_all'
  | 'confirm_bulk_delete'
  | 'filter_currency'
  | 'filter_active'
  | 'filter_inactive'
  // Labels (tables, forms)
  | 'label_id'
  | 'label_from'
  | 'label_to'
  | 'label_rate'
  | 'label_effective_date'
  | 'label_effective'
  | 'label_origin'
  | 'label_destination'
  | 'label_price'
  | 'label_currency'
  | 'label_status'
  | 'label_origin_region'
  | 'label_destination_region'
  | 'label_markup'
  | 'label_default_currency'
  | 'label_oversize_threshold'
  | 'label_waiting_period'
  | 'label_waiting_period_unit'
  | 'unit_minutes'
  | 'unit_hours'
  | 'unit_days'
  // Status values
  | 'status_active'
  | 'status_inactive'
  // Event types
  | 'event_quote_created'
  | 'event_quote_ready'
  | 'event_quote_approved'
  | 'event_quote_rejected'
  | 'event_quote_updated'
  | 'event_rfq_initiated'
  | 'event_rfq_quote_generated'
  | 'event_vendor_selected'
  | 'event_vendor_rfq_sent'
  | 'event_vendor_response'
  | 'event_login'
  | 'event_logout'
  | 'event_data_imported'
  // Channels / Languages / RFQ status
  | 'channel_email'
  | 'channel_web'
  | 'channel_whatsapp'
  | 'channel_telegram'
  | 'language_turkish'
  | 'language_english'
  | 'language_arabic'
  | 'rfq_status_open'
  | 'rfq_status_responded'
  | 'rfq_status_closed'
  // Auth
  | 'login_failed'
  | 'network_error_retry'
  | 'username'
  | 'password'
  | 'sign_in'
  // Misc UI
  | 'system_label'
  | 'ok'
  | 'unit_kg'
  | 'quote_prefix'
  | 'target_country'
  | 'created_at_label'
  | 'selected_vendors'
  | 'vendor_responses'
  | 'waiting_vendor_responses'
  | 'placeholder_origin_region'
  | 'placeholder_destination_region'
  | 'placeholder_current_price'
  | 'placeholder_customer_response'
  | 'settings_mode_auto_send'
  | 'settings_mode_low_confidence'
  | 'settings_mode_manual'
  | 'settings_mode_description'
  | 'aria_switch_language'
  | 'unknown_error'
  | 'login_subtitle'
  // Unmatched vendor replies
  | 'nav_unmatched_replies'
  | 'unmatched_replies_title'
  | 'unmatched_replies_empty'
  | 'unmatched_replies_contact'
  | 'unmatched_replies_channel'
  | 'unmatched_replies_parsed_price'
  | 'unmatched_replies_status'
  | 'unmatched_replies_created'
  | 'unmatched_replies_resolved'
  | 'unmatched_replies_actions'
  | 'unmatched_replies_delete_confirm'
  | 'unmatched_replies_deleted'
  | 'unmatched_replies_delete_failed'
  | 'unmatched_replies_mark_resolved'
  | 'unmatched_replies_mark_ignored'
  | 'unmatched_replies_mark_resolved_failed'
  | 'unmatched_replies_mark_ignored_failed'
  // Countries
  | 'countries_title'
  | 'label_code'
  | 'label_name_en'
  | 'label_name_tr'
  | 'label_active'
  | 'active'
  | 'inactive'
  | 'all_status'
  | 'yes'
  | 'no'
  // System status
  | 'system_health_title'
  | 'system_health_db'
  | 'system_health_vendors'
  | 'system_health_pricing'
  | 'system_health_postal'
  | 'system_health_countries'
  | 'system_health_rates'
  | 'system_health_config'
  | 'system_health_warnings'
  | 'system_health_ok'
  | 'system_health_missing'
  // Test messaging
  | 'nav_test_messaging'
  | 'test_messaging_title'
  | 'test_messaging_channel'
  | 'test_messaging_recipient'
  | 'test_messaging_message'
  | 'test_messaging_send'
  | 'test_messaging_result'
  | 'test_messaging_success'
  | 'test_messaging_failed'
  // Transport mode
  | 'transport_mode'
  | 'road_transport'
  | 'sea_transport'
  | 'filter_transport_mode';

const translations: Record<DashboardLocale, Record<TranslationKey, string>> = {
  tr: {
    app_title: 'Lojistik Yönetim Paneli',
    nav_home: 'Ana Sayfa',
    nav_quotes: 'Teklifler',
    nav_rfqs: 'RFQ Yönetimi',
    nav_history: 'İşlem Geçmişi',
    nav_master_data: 'Ana Veriler',
    nav_vendors: 'Tedarikçiler',
    nav_pricing: 'Rota Fiyatları',
    nav_settings: 'Sistem Ayarları',
    nav_admins: 'Yöneticiler',
    nav_exchange_rates: 'Döviz Kurları',
    nav_import: 'Veri İçe Aktar',
    nav_operations: 'Operasyonlar',
    logout: 'Çıkış Yap',
    language: 'Dil',
    dashboard_subtitle: 'Avrupa ve Türkiye arası taşımacılık operasyonlarınızı yönetin. Teklifler, tedarikçiler, rota fiyatları ve sistem ayarlarına erişin.',
    stat_total_requests: 'Toplam Talep',
    stat_total_quotes: 'Toplam Teklif',
    stat_pending_quotes: 'Bekleyen Teklif',
    stat_approved_quotes: 'Onaylanan Teklif',
    stat_rejected_quotes: 'Reddedilen Teklif',
    stat_sent_quotes: 'Gönderilen Teklif',
    stat_avg_response: 'Ort. Yanıt Süresi (dk)',
    stat_approval_rate: 'Onay Oranı (%)',
    channel_distribution: 'Kanal Dağılımı',
    language_distribution: 'Dil Dağılımı',
    daily_volume: 'Günlük Hacim (Son 30 Gün)',
    date: 'Tarih',
    requests: 'Talepler',
    quotes: 'Teklifler',
    no_data: 'Veri yok',
    route_pricing_card: 'Rota Fiyatları',
    route_pricing_desc: 'İhracat/ithalat fiyatlarını ve tonaj bazlı ücretleri yönetin.',
    vendors_card: 'Tedarikçiler',
    vendors_desc: 'Avrupa, Balkan, CIS ve iç hat tedarikçi ağınızı görüntüleyin.',
    settings_card: 'Sistem Ayarları',
    settings_desc: 'Onay modu, döviz kurları ve otomasyon parametrelerini yapılandırın.',
    quotes_title: 'Teklifler',
    quotes_count: 'kayıt',
    quotes_empty: 'Seçilen filtrelere uygun teklif bulunmamaktadır.',
    filter_status: 'Durum',
    filter_channel: 'Kanal',
    filter_language: 'Dil',
    filter_all: 'Tümü',
    status_pending: 'Beklemede',
    status_approved: 'Onaylandı',
    status_rejected: 'Reddedildi',
    status_ready: 'Gönderilmeye Hazır',
    status_sent: 'Müşteriye Gönderildi',
    quote_detail_title: 'Teklif',
    customer: 'Müşteri',
    origin_region: 'Çıkış Bölgesi',
    destination_region: 'Varış Bölgesi',
    origin_postal_code: 'Çıkış Posta Kodu',
    destination_postal_code: 'Varış Posta Kodu',
    currency: 'Para Birimi',
    weight: 'Ağırlık',
    base_price: 'Temel Fiyat',
    markup: 'Kar Marjı',
    final_price: 'Son Fiyat',
    language_label: 'Dil',
    channel_label: 'Kanal',
    toggle_state: 'Toggle Durumu',
    processed_by: 'İşlem Yapan',
    review_reason: 'İnceleme Nedeni',
    response_text: 'Müşteri Yanıt Metni',
    cargo_type: 'Yük Türü',
    original_message: 'Orijinal Mesaj',
    processed_at: 'İşlem tarihi',
    oversize_badge: 'Ağır Yük',
    rfq_badge: 'RFQ',
    internal_pricing_badge: 'Dahili Fiyat',
    price_pending: 'Beklemede',
    na: 'N/A',
    review_decision: 'İnceleme Kararı',
    approve: 'Onayla',
    reject: 'Reddet',
    revised_price: 'Düzeltilmiş Fiyat',
    keep_current_price: 'Mevcut fiyatı korumak için boş bırakın.',
    notes: 'Notlar',
    customer_response_text: 'Müşteri Yanıt Metni',
    confirm_approval: 'Onayı Onayla',
    confirm_rejection: 'Reddi Onayla',
    rejection_reason: 'Red Sebebi',
    rejection_reason_required: 'Red sebebi zorunludur',
    approving: 'Onaylanıyor...',
    rejecting: 'Reddediliyor...',
    network_error: 'Ağ hatası',
    approve_failed: 'Teklif onaylanamadı',
    reject_failed: 'Teklif reddedilemedi',
    rfq_title: 'RFQ Yönetimi',
    rfq_empty: 'Henüz RFQ kaydı bulunmamaktadır.',
    history_title: 'İşlem Geçmişi',
    history_export_csv: 'CSV Olarak İndir',
    event_type: 'Olay Tipi',
    admin: 'Yönetici',
    details: 'Detaylar',
    vendors_title: 'Tedarikçi Listesi',
    vendors_add: 'Tedarikçi Ekle',
    vendors_edit: 'Tedarikçi Düzenle',
    vendors_new: 'Yeni Tedarikçi',
    vendor_name: 'Firma Adı',
    vendor_origin: 'Ülke',
    vendor_origin_placeholder: 'Ülke seçin...',
    vendor_select_country: 'Ülke Seçin',
    vendor_city: 'Şehir',
    vendor_city_placeholder: 'Örn: İstanbul, Mersin...',
    vendor_authorized_person: 'Yetkili Kişi',
    vendor_authorized_person_placeholder: 'Örn: Ahmet Yılmaz',
    vendor_notes: 'Hizmet ve Notlar',
    vendor_notes_placeholder: 'Hizmet tipi, güzergah, notlar...',
    vendor_priority: 'Öncelik Sırası',
    vendor_priority_hint: 'Düşük değer = yüksek öncelik',
    vendor_margin: 'Marj Oranı (%)',
    vendor_margin_hint: 'Tedarikçi marjı',
    vendor_active: 'Aktif',
    vendor_email: 'E-posta',
    vendor_phone: 'Telefon',
    vendor_telegram: 'Telegram',
    vendor_preferred_channels: 'Tercih Edilen Kanallar',
    vendor_save: 'Ekle',
    vendor_update: 'Güncelle',
    vendor_cancel: 'İptal',
    vendor_delete_confirm: 'Bu tedarikçiyi silmek istediğinize emin misiniz?',
    vendor_delete: 'Sil',
    pricing_title: 'Rota Fiyatları',
    settings_title: 'Sistem Ayarları',
    exchange_rates_title: 'Döviz Kurları',
    error_loading: 'Yükleme hatası',
    loading: 'Yükleniyor...',
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    edit: 'Düzenle',
    actions: 'İşlemler',
    currency_try: 'TRY',
    import_title: 'Veri İçe Aktar',
    import_type: 'İçe Aktarım Türü',
    import_file: 'Dosya Seç (.xlsx, .xls veya .csv)',
    import_submit: 'İçe Aktar',
    import_loading: 'Yükleniyor...',
    import_result: 'kayıt eklendi / güncellendi,',
    import_records_inserted: 'kayıt eklendi',
    import_records_skipped: 'kayıt atlandı',
    import_error: 'Hata',
    import_requirements: 'Dosya Gereksinimleri',
    import_expected_columns: 'Beklenen Sütunlar',
    import_example_row: 'Örnek Satır',
    import_sheet_note: 'Sayfa Notu',
    import_accepted_formats: 'Kabul edilen formatlar: .xlsx, .xls, .csv',
    import_required: 'Zorunlu',
    import_optional: 'İsteğe bağlı',
    import_col_iso: 'ISO Ülke Kodu',
    import_col_prefix: 'Posta Kodu Prefix (ilk 2 hane)',
    import_col_region: 'Lojistik Bölge',
    import_col_origin: 'Çıkış Bölgesi',
    import_col_destination: 'Varış Bölgesi',
    import_col_price_export: 'İhracat Fiyatı',
    import_col_price_import: 'İthalat Fiyatı',
    import_col_currency: 'Para Birimi',
    import_col_company: 'Firma Adı',
    import_col_origin_city: 'Menşei / Şehir',
    import_col_email: 'E-posta',
    import_col_phone: 'Telefon',
    import_col_notes: 'Notlar',
    import_option_postal_codes: 'Posta Kodları',
    import_option_route_pricing: 'Rota Fiyatları',
    import_option_vendors: 'Tedarikçiler',
    import_option_countries: 'Ülkeler',
    page: 'Sayfa',
    of: '/',
    records: 'kayıt',
    prev: 'Önceki',
    next: 'Sonraki',
    search_placeholder: 'Ara...',
    delete_selected: 'Seçilenleri Sil',
    select_all: 'Tümünü Seç',
    confirm_bulk_delete: 'Seçilen {count} kaydı silmek istediğinize emin misiniz?',
    filter_currency: 'Para Birimi',
    filter_active: 'Aktif',
    filter_inactive: 'Pasif',
    label_id: 'ID',
    label_from: 'Başlangıç',
    label_to: 'Bitiş',
    label_rate: 'Kur',
    label_effective_date: 'Geçerlilik Tarihi',
    label_effective: 'Geçerli',
    label_origin: 'Çıkış',
    label_destination: 'Varış',
    label_price: 'Fiyat',
    label_currency: 'Para Birimi',
    label_status: 'Durum',
    label_origin_region: 'Çıkış Bölgesi',
    label_destination_region: 'Varış Bölgesi',
    label_markup: 'Kar Marjı (%)',
    label_default_currency: 'Varsayılan Para Birimi',
    label_oversize_threshold: 'Ağır Yük Eşiği (ton)',
    label_waiting_period: 'Bekleme Süresi',
    label_waiting_period_unit: 'Birim',
    unit_minutes: 'dakika',
    unit_hours: 'saat',
    unit_days: 'gün',
    status_active: 'Aktif',
    status_inactive: 'Pasif',
    event_quote_created: 'Teklif Oluşturuldu',
    event_quote_ready: 'Teklif Hazır',
    event_quote_approved: 'Teklif Onaylandı',
    event_quote_rejected: 'Teklif Reddedildi',
    event_quote_updated: 'Teklif Güncellendi',
    event_rfq_initiated: 'RFQ Başlatıldı',
    event_rfq_quote_generated: 'RFQ Teklifi Oluşturuldu',
    event_vendor_selected: 'Tedarikçi Seçildi',
    event_vendor_rfq_sent: 'Tedarikçiye RFQ Gönderildi',
    event_vendor_response: 'Tedarikçi Yanıtı',
    event_login: 'Giriş',
    event_logout: 'Çıkış',
    event_data_imported: 'Veri İçe Aktarıldı',
    channel_email: 'E-posta',
    channel_web: 'Web',
    channel_whatsapp: 'WhatsApp',
    channel_telegram: 'Telegram',
    language_turkish: 'Türkçe',
    language_english: 'İngilizce',
    language_arabic: 'Arapça',
    rfq_status_open: 'Açık',
    rfq_status_responded: 'Yanıtlandı',
    rfq_status_closed: 'Kapalı',
    login_failed: 'Giriş başarısız',
    network_error_retry: 'Ağ hatası. Lütfen tekrar deneyin.',
    username: 'Kullanıcı Adı',
    password: 'Şifre',
    sign_in: 'Giriş Yap',
    system_label: 'Sistem',
    ok: 'Tamam',
    unit_kg: 'kg',
    quote_prefix: 'Teklif #',
    target_country: 'Hedef Ülke',
    created_at_label: 'Oluşturulma',
    selected_vendors: 'Seçilen Tedarikçiler',
    vendor_responses: 'Tedarikçi Yanıtları',
    waiting_vendor_responses: 'Tedarikçi yanıtları bekleniyor...',
    placeholder_origin_region: 'İstanbul Anadolu, Bursa...',
    placeholder_destination_region: 'PL 3-4-5 Bölge, Almanya...',
    placeholder_current_price: 'Mevcut',
    placeholder_customer_response: 'Müşteri yanıt metni...',
    settings_mode_auto_send: 'Otomatik Gönder',
    settings_mode_low_confidence: 'Sadece Düşük Güven',
    settings_mode_manual: 'Manuel Onay',
    settings_mode_description: 'Otomatik: Teklifler doğrudan gönderilir. Düşük Güven: Sadece belirsiz teklifler incelenir. Manuel: Tüm teklifler onay gerektirir.',
    aria_switch_language: 'Dili Değiştir',
    unknown_error: 'Bilinmeyen hata',
    login_subtitle: 'Yönetici hesabınızla giriş yapın',
    nav_unmatched_replies: 'Eşleşmeyen Yanıtlar',
    unmatched_replies_title: 'Eşleşmeyen Tedarikçi Yanıtları',
    unmatched_replies_empty: 'Henüz eşleşmeyen tedarikçi yanıtı bulunmamaktadır.',
    unmatched_replies_contact: 'İletişim',
    unmatched_replies_channel: 'Kanal',
    unmatched_replies_parsed_price: 'Çıkarılan Fiyat',
    unmatched_replies_status: 'Durum',
    unmatched_replies_created: 'Gelen',
    unmatched_replies_resolved: 'Çözüldü',
    unmatched_replies_actions: 'İşlemler',
    unmatched_replies_delete_confirm: 'Bu yanıtı silmek istediğinize emin misiniz?',
    unmatched_replies_deleted: 'Silindi',
    unmatched_replies_delete_failed: 'Silinemedi',
    unmatched_replies_mark_resolved: 'Çözüldü Olarak İşaretle',
    unmatched_replies_mark_ignored: 'Yoksay',
    unmatched_replies_mark_resolved_failed: 'İşaretlenemedi',
    unmatched_replies_mark_ignored_failed: 'Yoksayma başarısız',
    nav_countries: 'Ülkeler',
    countries_title: 'Ülkeler',
    label_code: 'Kod',
    label_name_en: 'İngilizce Ad',
    label_name_tr: 'Türkçe Ad',
    label_active: 'Aktif',
    active: 'Aktif',
    inactive: 'Pasif',
    all_status: 'Tümü',
    yes: 'Evet',
    no: 'Hayır',
    system_health_title: 'Sistem Durumu',
    system_health_db: 'Veritabanı',
    system_health_vendors: 'Tedarikçiler',
    system_health_pricing: 'Rota Fiyatları',
    system_health_postal: 'Posta Kodları',
    system_health_countries: 'Ülkeler',
    system_health_rates: 'Döviz Kurları',
    system_health_config: 'Yapılandırma',
    system_health_warnings: 'Uyarılar',
    system_health_ok: 'Tamam',
    system_health_missing: 'Eksik',
    nav_test_messaging: 'Mesaj Testi',
    test_messaging_title: 'Kanal Mesaj Testi',
    test_messaging_channel: 'Kanal',
    test_messaging_recipient: 'Alıcı',
    test_messaging_message: 'Mesaj',
    test_messaging_send: 'Gönder',
    test_messaging_result: 'Sonuç',
    test_messaging_success: 'Başarılı',
    test_messaging_failed: 'Başarısız',
    transport_mode: 'Taşıma Modu',
    road_transport: 'Kara',
    sea_transport: 'Deniz',
    filter_transport_mode: 'Taşıma Modu',
  },
  en: {
    app_title: 'Dashboard',
    nav_home: 'Home',
    nav_quotes: 'Quotes',
    nav_rfqs: 'RFQ Management',
    nav_history: 'Transaction History',
    nav_master_data: 'Master Data',
    nav_vendors: 'Vendors',
    nav_pricing: 'Route Pricing',
    nav_settings: 'System Settings',
    nav_admins: 'Admins',
    nav_exchange_rates: 'Exchange Rates',
    nav_import: 'Import Data',
    nav_operations: 'Operations',
    logout: 'Logout',
    language: 'Language',
    dashboard_subtitle: 'Manage your Europe-Turkey logistics operations. Access quotes, vendors, route pricing, and system settings.',
    stat_total_requests: 'Total Requests',
    stat_total_quotes: 'Total Quotes',
    stat_pending_quotes: 'Pending Quotes',
    stat_approved_quotes: 'Approved Quotes',
    stat_rejected_quotes: 'Rejected Quotes',
    stat_sent_quotes: 'Sent Quotes',
    stat_avg_response: 'Avg. Response (min)',
    stat_approval_rate: 'Approval Rate (%)',
    channel_distribution: 'Channel Distribution',
    language_distribution: 'Language Distribution',
    daily_volume: 'Daily Volume (Last 30 Days)',
    date: 'Date',
    requests: 'Requests',
    quotes: 'Quotes',
    no_data: 'No data',
    route_pricing_card: 'Route Pricing',
    route_pricing_desc: 'Manage export/import prices and tonnage-based fees.',
    vendors_card: 'Vendors',
    vendors_desc: 'View your Europe, Balkans, CIS, and domestic vendor network.',
    settings_card: 'System Settings',
    settings_desc: 'Configure approval mode, exchange rates, and automation parameters.',
    quotes_title: 'Quotes',
    quotes_count: 'records',
    quotes_empty: 'No quotes match the selected filters.',
    filter_status: 'Status',
    filter_channel: 'Channel',
    filter_language: 'Language',
    filter_all: 'All',
    status_pending: 'Pending',
    status_approved: 'Approved',
    status_rejected: 'Rejected',
    status_ready: 'Ready to Send',
    status_sent: 'Sent to Customer',
    quote_detail_title: 'Quote',
    customer: 'Customer',
    origin_region: 'Origin Region',
    destination_region: 'Destination Region',
    origin_postal_code: 'Origin Postal Code',
    destination_postal_code: 'Destination Postal Code',
    currency: 'Currency',
    weight: 'Weight',
    base_price: 'Base Price',
    markup: 'Markup',
    final_price: 'Final Price',
    language_label: 'Language',
    channel_label: 'Channel',
    toggle_state: 'Toggle State',
    processed_by: 'Processed By',
    review_reason: 'Review Reason',
    response_text: 'Customer Response Text',
    cargo_type: 'Cargo Type',
    original_message: 'Original Message',
    processed_at: 'Processed at',
    oversize_badge: 'Oversize',
    rfq_badge: 'RFQ',
    internal_pricing_badge: 'Internal Pricing',
    price_pending: 'Pending',
    na: 'N/A',
    review_decision: 'Review Decision',
    approve: 'Approve',
    reject: 'Reject',
    revised_price: 'Revised Price',
    keep_current_price: 'Leave blank to keep current price.',
    notes: 'Notes',
    customer_response_text: 'Customer Response Text',
    confirm_approval: 'Confirm Approval',
    confirm_rejection: 'Confirm Rejection',
    rejection_reason: 'Rejection Reason',
    rejection_reason_required: 'Rejection reason is required',
    approving: 'Approving...',
    rejecting: 'Rejecting...',
    network_error: 'Network error',
    approve_failed: 'Failed to approve quote',
    reject_failed: 'Failed to reject quote',
    rfq_title: 'RFQ Management',
    rfq_empty: 'No RFQ records found.',
    history_title: 'Transaction History',
    history_export_csv: 'Download as CSV',
    event_type: 'Event Type',
    admin: 'Admin',
    details: 'Details',
    vendors_title: 'Vendor List',
    vendors_add: 'Add Vendor',
    vendors_edit: 'Edit Vendor',
    vendors_new: 'New Vendor',
    vendor_name: 'Company Name',
    vendor_origin: 'Country',
    vendor_origin_placeholder: 'Select a country...',
    vendor_select_country: 'Select Country',
    vendor_city: 'City',
    vendor_city_placeholder: 'e.g. Istanbul, Mersin...',
    vendor_authorized_person: 'Authorized Person',
    vendor_authorized_person_placeholder: 'e.g. Ahmet Yilmaz',
    vendor_notes: 'Services and Notes',
    vendor_notes_placeholder: 'Service type, route, notes...',
    vendor_priority: 'Priority Ranking',
    vendor_priority_hint: 'Lower value = higher priority',
    vendor_margin: 'Margin Rate (%)',
    vendor_margin_hint: 'Vendor margin',
    vendor_active: 'Active',
    vendor_email: 'Email',
    vendor_phone: 'Phone',
    vendor_telegram: 'Telegram',
    vendor_preferred_channels: 'Preferred Channels',
    vendor_save: 'Add',
    vendor_update: 'Update',
    vendor_cancel: 'Cancel',
    vendor_delete_confirm: 'Are you sure you want to delete this vendor?',
    vendor_delete: 'Delete',
    pricing_title: 'Route Pricing',
    settings_title: 'System Settings',
    exchange_rates_title: 'Exchange Rates',
    error_loading: 'Loading error',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    actions: 'Actions',
    currency_try: 'TRY',
    import_title: 'Import Data',
    import_type: 'Import Type',
    import_file: 'Select File (.xlsx, .xls, or .csv)',
    import_submit: 'Import',
    import_loading: 'Loading...',
    import_result: 'records added / updated,',
    import_records_inserted: 'records inserted',
    import_records_skipped: 'records skipped',
    import_error: 'Error',
    import_requirements: 'File Requirements',
    import_expected_columns: 'Expected Columns',
    import_example_row: 'Example Row',
    import_sheet_note: 'Sheet Note',
    import_accepted_formats: 'Accepted formats: .xlsx, .xls, .csv',
    import_required: 'Required',
    import_optional: 'Optional',
    import_col_iso: 'ISO Country Code',
    import_col_prefix: 'Postal Code Prefix (first 2 digits)',
    import_col_region: 'Logistics Region',
    import_col_origin: 'Origin Region',
    import_col_destination: 'Destination Region',
    import_col_price_export: 'Export Price',
    import_col_price_import: 'Import Price',
    import_col_currency: 'Currency',
    import_col_company: 'Company Name',
    import_col_origin_city: 'Origin / City',
    import_col_email: 'Email',
    import_col_phone: 'Phone',
    import_col_notes: 'Notes',
    import_option_postal_codes: 'Postal Codes',
    import_option_route_pricing: 'Route Pricing',
    import_option_vendors: 'Vendors',
    import_option_countries: 'Countries',
    page: 'Page',
    of: 'of',
    records: 'records',
    prev: 'Prev',
    next: 'Next',
    search_placeholder: 'Search...',
    delete_selected: 'Delete Selected',
    select_all: 'Select All',
    confirm_bulk_delete: 'Are you sure you want to delete {count} selected records?',
    filter_currency: 'Currency',
    filter_active: 'Active',
    filter_inactive: 'Inactive',
    label_id: 'ID',
    label_from: 'From',
    label_to: 'To',
    label_rate: 'Rate',
    label_effective_date: 'Effective Date',
    label_effective: 'Effective',
    label_origin: 'Origin',
    label_destination: 'Destination',
    label_price: 'Price',
    label_currency: 'Currency',
    label_status: 'Status',
    label_origin_region: 'Origin Region',
    label_destination_region: 'Destination Region',
    label_markup: 'Markup (%)',
    label_default_currency: 'Default Currency',
    label_oversize_threshold: 'Oversize Threshold (tons)',
    label_waiting_period: 'Waiting Period',
    label_waiting_period_unit: 'Unit',
    unit_minutes: 'minutes',
    unit_hours: 'hours',
    unit_days: 'days',
    status_active: 'Active',
    status_inactive: 'Inactive',
    event_quote_created: 'Quote Created',
    event_quote_ready: 'Quote Ready',
    event_quote_approved: 'Quote Approved',
    event_quote_rejected: 'Quote Rejected',
    event_quote_updated: 'Quote Updated',
    event_rfq_initiated: 'RFQ Initiated',
    event_rfq_quote_generated: 'RFQ Quote Generated',
    event_vendor_selected: 'Vendor Selected',
    event_vendor_rfq_sent: 'Vendor RFQ Sent',
    event_vendor_response: 'Vendor Response',
    event_login: 'Login',
    event_logout: 'Logout',
    event_data_imported: 'Data Imported',
    channel_email: 'Email',
    channel_web: 'Web',
    channel_whatsapp: 'WhatsApp',
    channel_telegram: 'Telegram',
    language_turkish: 'Turkish',
    language_english: 'English',
    language_arabic: 'Arabic',
    rfq_status_open: 'Open',
    rfq_status_responded: 'Responded',
    rfq_status_closed: 'Closed',
    login_failed: 'Login failed',
    network_error_retry: 'Network error. Please try again.',
    username: 'Username',
    password: 'Password',
    sign_in: 'Sign In',
    system_label: 'System',
    ok: 'OK',
    unit_kg: 'kg',
    quote_prefix: 'Quote #',
    target_country: 'Target Country',
    created_at_label: 'Created',
    selected_vendors: 'Selected Vendors',
    vendor_responses: 'Vendor Responses',
    waiting_vendor_responses: 'Waiting for vendor responses...',
    placeholder_origin_region: 'Istanbul Anatolia, Bursa...',
    placeholder_destination_region: 'PL 3-4-5 Region, Germany...',
    placeholder_current_price: 'Current',
    placeholder_customer_response: 'Customer response text...',
    settings_mode_auto_send: 'Auto Send',
    settings_mode_low_confidence: 'Low Confidence Only',
    settings_mode_manual: 'Manual Approval',
    settings_mode_description: 'Auto: Quotes sent directly. Low Confidence: Only uncertain quotes are reviewed. Manual: All quotes require approval.',
    aria_switch_language: 'Switch Language',
    unknown_error: 'Unknown error',
    login_subtitle: 'Sign in with your administrator account',
    nav_unmatched_replies: 'Unmatched Replies',
    unmatched_replies_title: 'Unmatched Vendor Replies',
    unmatched_replies_empty: 'No unmatched vendor replies found.',
    unmatched_replies_contact: 'Contact',
    unmatched_replies_channel: 'Channel',
    unmatched_replies_parsed_price: 'Parsed Price',
    unmatched_replies_status: 'Status',
    unmatched_replies_created: 'Received',
    unmatched_replies_resolved: 'Resolved',
    unmatched_replies_actions: 'Actions',
    unmatched_replies_delete_confirm: 'Are you sure you want to delete this reply?',
    unmatched_replies_deleted: 'Deleted',
    unmatched_replies_delete_failed: 'Failed to delete',
    unmatched_replies_mark_resolved: 'Mark Resolved',
    unmatched_replies_mark_ignored: 'Ignore',
    unmatched_replies_mark_resolved_failed: 'Failed to mark resolved',
    unmatched_replies_mark_ignored_failed: 'Failed to ignore',
    nav_countries: 'Countries',
    countries_title: 'Countries',
    label_code: 'Code',
    label_name_en: 'English Name',
    label_name_tr: 'Turkish Name',
    label_active: 'Active',
    active: 'Active',
    inactive: 'Inactive',
    all_status: 'All',
    yes: 'Yes',
    no: 'No',
    system_health_title: 'System Health',
    system_health_db: 'Database',
    system_health_vendors: 'Vendors',
    system_health_pricing: 'Route Pricing',
    system_health_postal: 'Postal Codes',
    system_health_countries: 'Countries',
    system_health_rates: 'Exchange Rates',
    system_health_config: 'Configuration',
    system_health_warnings: 'Warnings',
    system_health_ok: 'OK',
    system_health_missing: 'Missing',
    nav_test_messaging: 'Test Messaging',
    test_messaging_title: 'Channel Message Test',
    test_messaging_channel: 'Channel',
    test_messaging_recipient: 'Recipient',
    test_messaging_message: 'Message',
    test_messaging_send: 'Send',
    test_messaging_result: 'Result',
    test_messaging_success: 'Success',
    test_messaging_failed: 'Failed',
    transport_mode: 'Transport Mode',
    road_transport: 'Road',
    sea_transport: 'Sea',
    filter_transport_mode: 'Transport Mode',
  },
};

export function t(key: TranslationKey, locale: DashboardLocale = DEFAULT_LOCALE): string {
  return translations[locale][key] ?? key;
}
