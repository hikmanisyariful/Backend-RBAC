function ok(data, message = "OK", code = 200) {
  return { Meta: { Code: code, Status: true, Message: message }, Data: data };
}

function fail(message = "Error", code = 400, data = null) {
  return { Meta: { Code: code, Status: false, Message: message }, Data: data };
}

module.exports = { ok, fail };
