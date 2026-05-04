const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
const path = require('path');

const excelDir = path.join(__dirname, 'excel_files');

async function main() {
  // Parse DATABASE_URL
  const dbUrl = process.env.DATABASE_URL || 'mysql://root:ahmed@RAGAB010@localhost:3306/logistics_dashboard';
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  const connection = await mysql.createConnection({
    host: match[3],
    port: parseInt(match[4], 10),
    user: match[1],
    password: match[2],
    database: match[5],
  });

  console.log('Connected to MySQL');

  // ─── 1. Import Postal Codes ───────────────────────────────────────
  console.log('\n📮 Posta kodları içe aktarılıyor...');
  const postalWb = XLSX.readFile(path.join(excelDir, 'Avrupa Posta Kodu Lojistik.xlsx'));
  const postalSheet = postalWb.Sheets['Avrupa İlk 2 Hane'];
  const postalData = XLSX.utils.sheet_to_json(postalSheet, { header: 1 });

  await connection.execute('DELETE FROM postal_codes');

  let postalCount = 0;
  for (let i = 1; i < postalData.length; i++) {
    const row = postalData[i];
    if (!row || !row[1] || !row[2]) continue;

    const country = String(row[0] || '').trim();
    const iso = String(row[1] || '').trim().toUpperCase();
    const prefixRange = String(row[2] || '').trim();
    const postalRegion = String(row[4] || '').trim();
    const logisticsRegion = String(row[5] || '').trim();

    const ranges = prefixRange.split(',').map(r => r.trim()).filter(Boolean);

    for (const range of ranges) {
      const match = range.match(/^(\d+)-(\d+)$/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        for (let p = start; p <= end; p++) {
          const prefix = String(p).padStart(2, '0');
          try {
            await connection.execute(
              `INSERT INTO postal_codes (country_code, prefix, region, prefix_length) VALUES (?, ?, ?, ?)`,
              [iso, prefix, `${country} - ${postalRegion || logisticsRegion}`, 2]
            );
            postalCount++;
          } catch (e) {}
        }
      } else {
        const prefix = range.padStart(2, '0');
        try {
          await connection.execute(
            `INSERT INTO postal_codes (country_code, prefix, region, prefix_length) VALUES (?, ?, ?, ?)`,
            [iso, prefix, `${country} - ${postalRegion || logisticsRegion}`, 2]
          );
          postalCount++;
        } catch (e) {}
      }
    }
  }
  console.log(`✅ ${postalCount} posta kodu içe aktarıldı`);

  // ─── 2. Import Route Pricing ──────────────────────────────────────
  console.log('\n💰 Rota fiyatları içe aktarılıyor...');
  const priceWb = XLSX.readFile(path.join(excelDir, 'Rota Fiyat.xlsx'));
  const priceSheet = priceWb.Sheets[priceWb.SheetNames[0]];
  const priceData = XLSX.utils.sheet_to_json(priceSheet, { header: 1 });

  await connection.execute('DELETE FROM route_pricing');

  let priceCount = 0;
  for (let i = 2; i < priceData.length; i++) {
    const row = priceData[i];
    if (!row || !row[1] || !row[2]) continue;

    const origin = String(row[1] || '').trim();
    const destination = String(row[2] || '').trim();
    const exportPrice = parseFloat(row[4]) || 0;
    const currency = String(row[5] || '').trim().toUpperCase() || 'EUR';
    const importPrice = parseFloat(row[6]) || 0;

    if (!origin || !destination || (!exportPrice && !importPrice)) continue;

    if (exportPrice > 0) {
      await connection.execute(
        `INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent, currency, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [origin, destination, exportPrice, 0, currency, true]
      );
      priceCount++;
    }

    if (importPrice > 0) {
      await connection.execute(
        `INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent, currency, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [destination, origin, importPrice, 0, currency, true]
      );
      priceCount++;
    }
  }
  console.log(`✅ ${priceCount} rota fiyatı içe aktarıldı`);

  // ─── 3. Import Vendors ────────────────────────────────────────────
  console.log('\n🚛 Tedarikçiler içe aktarılıyor...');
  const vendorWb = XLSX.readFile(path.join(excelDir, 'Tedarik Listeler.xlsx'));

  await connection.execute('DELETE FROM vendors');

  let vendorCount = 0;
  const serviceTypes = vendorWb.SheetNames;

  for (const sheetName of serviceTypes) {
    const sheet = vendorWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[2]) continue;

      const firma = String(row[2] || '').trim();
      if (!firma) continue;

      const menşei = String(row[1] || '').trim();
      const not = String(row[9] || '').trim();
      const mailIhracat = String(row[5] || '').trim();
      const mailIthalat = String(row[6] || '').trim();
      const talepMail = String(row[10] || '').trim();
      const cep = String(row[7] || '').trim();
      const tel = String(row[8] || '').trim();

      const expertise = [
        `Hizmet: ${sheetName}`,
        not ? `Not: ${not}` : null,
        menşei ? `Merkez: ${menşei}` : null,
      ].filter(Boolean).join(' | ');

      const contactEmail = mailIhracat || mailIthalat || talepMail || null;
      const contactPhone = cep || tel || null;

      try {
        await connection.execute(
          `INSERT INTO vendors (name, country_coverage, expertise_notes, priority_ranking, contact_email, contact_phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [firma, menşei || 'Türkiye', expertise, 100, contactEmail, contactPhone, true]
        );
        vendorCount++;
      } catch (e) {
        console.warn(`⚠️ ${firma} içe aktarılamadı:`, e.message);
      }
    }
  }
  console.log(`✅ ${vendorCount} tedarikçi içe aktarıldı`);

  await connection.end();
  console.log('\n🎉 Tüm veriler başarıyla içe aktarıldı!');
}

main().catch(err => {
  console.error('İçe aktarma başarısız:', err);
  process.exit(1);
});
