const fs = require("fs");

function logError(context, error) {
  const time = new Date().toISOString();
  const message = `
[${time}]
[${context}]
${error?.message || error}
--------------------------------
`;

  fs.appendFileSync("error.log", message);
}

module.exports = { logError };
