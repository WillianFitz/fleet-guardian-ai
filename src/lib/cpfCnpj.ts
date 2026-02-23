export function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

export function validateCPF(cpf: string) {
  const v = onlyDigits(cpf);
  if (v.length !== 11) return false;
  if (/^(\d)\1+$/.test(v)) return false;
  const nums = v.split("").map((d) => parseInt(d, 10));
  // calc first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== nums[9]) return false;
  // second
  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === nums[10];
}

export function validateCNPJ(cnpj: string) {
  const v = onlyDigits(cnpj);
  if (v.length !== 14) return false;
  if (/^(\d)\1+$/.test(v)) return false;
  const numbers = v.split("").map((n) => parseInt(n, 10));
  const calc = (pos: number) => {
    let sum = 0;
    let size = pos - 7;
    for (let i = pos; i >= 1; i--) {
      sum += numbers[pos - i] * size--;
      if (size < 2) size = 9;
    }
    const res = sum % 11;
    return res < 2 ? 0 : 11 - res;
  };
  const dv1 = calc(12);
  const dv2 = calc(13);
  return dv1 === numbers[12] && dv2 === numbers[13];
}

export async function fetchCnpjData(cnpj: string) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) throw new Error("CNPJ inválido");
  // usar BrasilAPI
  const url = `https://brasilapi.com.br/api/cnpj/v1/${digits}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar CNPJ");
  const json = await res.json();
  return json;
}

