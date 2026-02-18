let last = 0;
let repeat = 0;

export default function (): number {
  const length = 15;

  const now = Math.pow(10, 2) * +new Date();

  if (now == last) {
    repeat++;
  } else {
    repeat = 0;
    last = now;
  }

  const s = (now + repeat).toString();
  return +s.substring(s.length - length);
}
