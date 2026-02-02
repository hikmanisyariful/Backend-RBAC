require("dotenv").config();
const { app } = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
