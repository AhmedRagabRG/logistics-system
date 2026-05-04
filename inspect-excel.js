const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(__dirname, 'excel_files');

function inspectFile(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${filename}`);
  console.log('='.repeat(60));
  
  const filepath = path.join(excelDir, filename);
  const workbook = XLSX.readFile(filepath);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: "${sheetName}" ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Show first 15 rows
    data.slice(0, 15).forEach((row, i) => {
      console.log(`Row ${i}:`, row);
    });
    
    console.log(`... (${data.length} total rows)`);
  });
}

const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
files.forEach(inspectFile);
