const conversionFactors = {
  length: {
    meter: 1,
    meters: 1,
    m: 1,

    kilometer: 1000,
    kilometers: 1000,
    km: 1000,

    centimeter: 0.01,
    centimeters: 0.01,
    cm: 0.01,

    millimeter: 0.001,
    millimeters: 0.001,
    mm: 0.001,

    mile: 1609.344,
    miles: 1609.344,
    mi: 1609.344,

    yard: 0.9144,
    yards: 0.9144,
    yd: 0.9144,

    foot: 0.3048,
    feet: 0.3048,
    ft: 0.3048,

    inch: 0.0254,
    inches: 0.0254,
    in: 0.0254,
  },

  weight: {
    gram: 1,
    grams: 1,
    g: 1,

    kilogram: 1000,
    kilograms: 1000,
    kg: 1000,

    milligram: 0.001,
    milligrams: 0.001,
    mg: 0.001,

    pound: 453.59237,
    pounds: 453.59237,
    lb: 453.59237,
    lbs: 453.59237,

    ounce: 28.349523125,
    ounces: 28.349523125,
    oz: 28.349523125,
  },

  volume: {
    liter: 1,
    liters: 1,
    l: 1,

    milliliter: 0.001,
    milliliters: 0.001,
    ml: 0.001,

    gallon: 3.785411784,
    gallons: 3.785411784,
    gal: 3.785411784,

    quart: 0.946352946,
    quarts: 0.946352946,

    pint: 0.473176473,
    pints: 0.473176473,

    cup: 0.2365882365,
    cups: 0.2365882365,
  },

  area: {
    "square meter": 1,
    "square meters": 1,
    "m2": 1,

    "square kilometer": 1000000,
    "square kilometers": 1000000,
    "km2": 1000000,

    "square foot": 0.09290304,
    "square feet": 0.09290304,
    "sq ft": 0.09290304,

    "square yard": 0.83612736,
    "square yards": 0.83612736,

    acre: 4046.8564224,
    acres: 4046.8564224,

    hectare: 10000,
    hectares: 10000,
  },
};

const normalizeUnit = (unit) => {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const findUnitCategory = (unit) => {
  const normalizedUnit = normalizeUnit(unit);

  for (const [category, units] of Object.entries(conversionFactors)) {
    if (Object.prototype.hasOwnProperty.call(units, normalizedUnit)) {
      return {
        category,
        factor: units[normalizedUnit],
        unit: normalizedUnit,
      };
    }
  }

  return null;
};

const formatNumber = (value) => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number(value.toFixed(10)).toString();
};

const convertUnit = ({ value, from, to }) => {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    throw new Error("A valid numeric value is required");
  }

  if (!from || !to) {
    throw new Error("Both source and target units are required");
  }

  const numericValue = Number(value);

  const sourceUnit = findUnitCategory(from);
  const targetUnit = findUnitCategory(to);

  if (!sourceUnit) {
    throw new Error(`Unsupported source unit: ${from}`);
  }

  if (!targetUnit) {
    throw new Error(`Unsupported target unit: ${to}`);
  }

  if (sourceUnit.category !== targetUnit.category) {
    throw new Error(
      `Cannot convert ${sourceUnit.category} to ${targetUnit.category}`,
    );
  }

  const baseValue = numericValue * sourceUnit.factor;
  const result = baseValue / targetUnit.factor;

  return {
    value: numericValue,
    from,
    to,
    result: formatNumber(result),
    category: sourceUnit.category,
  };
};

export default convertUnit;