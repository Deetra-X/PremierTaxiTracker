import { getEnv } from "./env.js";
import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(getEnv("DATABASE_URL"), {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

export async function connectDb(
  { sync = false, force = false, alter = false } = { sync: false }
) {
  await sequelize.authenticate();

  if (sync) {
    await sequelize.sync({ force, alter });
  }

  return sequelize;
}

export async function disconnectDb() {
  await sequelize.close();
}