const FRANKFURTER_API = "https://api.frankfurter.dev/v2";

const convertCurrency = async ({ amount, from, to }) => {
  if (
    amount === undefined ||
    amount === null ||
    !Number.isFinite(Number(amount))
  ) {
    throw new Error("A valid numeric amount is required");
  }

  if (!from || typeof from !== "string") {
    throw new Error("Source currency is required");
  }

  if (!to || typeof to !== "string") {
    throw new Error("Target currency is required");
  }

  const numericAmount = Number(amount);
  const sourceCurrency = from.trim().toUpperCase();
  const targetCurrency = to.trim().toUpperCase();

  if (sourceCurrency.length !== 3 || targetCurrency.length !== 3) {
    throw new Error("Currency codes must be 3-letter ISO codes");
  }

  if (sourceCurrency === targetCurrency) {
    return {
      amount: numericAmount,
      from: sourceCurrency,
      to: targetCurrency,
      rate: 1,
      convertedAmount: numericAmount,
      date: new Date().toISOString().slice(0, 10),
    };
  }

  const url =
    `${FRANKFURTER_API}/rate/` +
    `${encodeURIComponent(sourceCurrency)}/` +
    `${encodeURIComponent(targetCurrency)}`;

  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Currency service is unavailable", { cause: error });
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Invalid response from currency service", { cause: error });
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Unable to get ${sourceCurrency} to ${targetCurrency} exchange rate`,
    );
  }

  const rate = Number(data?.rate);

  if (!Number.isFinite(rate)) {
    throw new Error("Invalid exchange rate received");
  }

  const convertedAmount = numericAmount * rate;

  return {
    amount: numericAmount,
    from: sourceCurrency,
    to: targetCurrency,
    rate,
    convertedAmount: Number(convertedAmount.toFixed(6)),
    date: data.date,
  };
};

export default convertCurrency;
