import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function Log(stack, level, packageName, message) {
  try {
    console.log("Sending Log...");

    const response = await axios.post(
      "http://4.224.186.213/evaluation-service/logs",
      {
        stack: stack,
        level: level,
        package: packageName,
        message: message,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJzYWlzaHJ1dGhpLmRkQGdtYWlsLmNvbSIsImV4cCI6MTc4MTA3MjkzMSwiaWF0IjoxNzgxMDcyMDMxLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYmYzMmU3YmMtMjQwZC00NTc1LTgxMzQtNzkwOWE0ZDk0ODhjIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiZCBzYWkgc2hydXRoaSIsInN1YiI6ImZlNDMxOGVmLTVkYWUtNDA3ZS1hYWE4LTYyNWZkYzgwNTNiOSJ9LCJlbWFpbCI6InNhaXNocnV0aGkuZGRAZ21haWwuY29tIiwibmFtZSI6ImQgc2FpIHNocnV0aGkiLCJyb2xsTm8iOiJlMDMyMzAyOCIsImFjY2Vzc0NvZGUiOiJEdndFRFoiLCJjbGllbnRJRCI6ImZlNDMxOGVmLTVkYWUtNDA3ZS1hYWE4LTYyNWZkYzgwNTNiOSIsImNsaWVudFNlY3JldCI6InJmd2ZUWHFBYmdCbkV1YlkifQ.6VcveO1zUX4jmfHfYhwcBWxv_ZHVXO1NPAlW_7JMhaM"}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Log created successfully");
    console.log(response.data);

    return response.data;
  } catch (error) {
    console.log("❌ Logging failed");

    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Response:", error.response.data);
    } else {
      console.log(error.message);
    }
  }
}