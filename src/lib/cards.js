// Deterministic, client-generated card details. They are stored on the
// private user doc at registration time.
function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = +num[num.length - 1 - i];
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export function generateCardNumber() {
  for (let tries = 0; tries < 50; tries++) {
    // 4-digit Platinum prefix + 11 random digits + 1 Luhn check digit = 16.
    let body = '5291' + String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
    const digits = body.split('').map(Number);
    let check = 0;
    for (let i = 0; i < digits.length; i++) {
      let d = digits[digits.length - 1 - i];
      if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      check += d;
    }
    const last = (10 - (check % 10)) % 10;
    const num = body + last;
    if (luhn(num)) return num;
  }
  return '5291' + String(Date.now()).padStart(12, '0') + '0';
}

export function generateCVV() {
  return String(Math.floor(100 + Math.random() * 900));
}

export function generateExpiry() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 4);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

export function maskCard(n) {
  if (!n) return '';
  return '•••• •••• •••• ' + n.slice(-4);
}

export function formatCard(n) {
  return String(n).replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function fmtCredits(n) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
