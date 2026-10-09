const calculate = (expression) => {
  if (!expression || typeof expression !== "string") {
    throw new Error("Expression is required");
  }

  let value = expression
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/\s+/g, " ");

  // Percentage: 15% of 800
  const percentageMatch = value.match(
    /^(-?\d+(?:\.\d+)?)\s*%\s*of\s*(-?\d+(?:\.\d+)?)$/,
  );

  if (percentageMatch) {
    const percentage = Number(percentageMatch[1]);
    const number = Number(percentageMatch[2]);

    return (percentage / 100) * number;
  }

  // Only allow basic mathematical expressions
  if (!/^[0-9+\-*/().%\s]+$/.test(value)) {
    throw new Error("Invalid mathematical expression");
  }

  // Prevent dangerous operators / malformed expressions
  if (value.includes("..") || value.includes("//")) {
    throw new Error("Invalid mathematical expression");
  }

  // Tokenize numbers and operators
  const tokens = value.match(/(?:\d+(?:\.\d+)?|[+\-*/().])/g);

  if (!tokens || tokens.join("") !== value.replace(/\s/g, "")) {
    throw new Error("Invalid mathematical expression");
  }

  const numbers = [];
  const operators = [];

  const precedence = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
  };

  const applyOperation = () => {
    const operator = operators.pop();
    const right = numbers.pop();
    const left = numbers.pop();

    if (left === undefined || right === undefined) {
      throw new Error("Invalid mathematical expression");
    }

    let result;

    switch (operator) {
      case "+":
        result = left + right;
        break;

      case "-":
        result = left - right;
        break;

      case "*":
        result = left * right;
        break;

      case "/":
        if (right === 0) {
          throw new Error("Cannot divide by zero");
        }

        result = left / right;
        break;

      default:
        throw new Error("Invalid operator");
    }

    numbers.push(result);
  };

  let expectNumber = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!Number.isNaN(Number(token)) && token !== "") {
      numbers.push(Number(token));
      expectNumber = false;
      continue;
    }

    if (token === "(") {
      operators.push(token);
      expectNumber = true;
      continue;
    }

    if (token === ")") {
      while (
        operators.length &&
        operators[operators.length - 1] !== "("
      ) {
        applyOperation();
      }

      if (
        !operators.length ||
        operators[operators.length - 1] !== "("
      ) {
        throw new Error("Invalid parentheses");
      }

      operators.pop();
      expectNumber = false;
      continue;
    }

    if (["+", "-", "*", "/"].includes(token)) {
      // Support negative numbers
      if (token === "-" && expectNumber) {
        numbers.push(0);
      } else if (expectNumber) {
        throw new Error("Invalid mathematical expression");
      }

      while (
        operators.length &&
        operators[operators.length - 1] !== "(" &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        applyOperation();
      }

      operators.push(token);
      expectNumber = true;
    }
  }

  if (expectNumber) {
    throw new Error("Invalid mathematical expression");
  }

  while (operators.length) {
    if (operators[operators.length - 1] === "(") {
      throw new Error("Invalid parentheses");
    }

    applyOperation();
  }

  if (numbers.length !== 1 || !Number.isFinite(numbers[0])) {
    throw new Error("Invalid calculation result");
  }

  return numbers[0];
};

export default calculate;