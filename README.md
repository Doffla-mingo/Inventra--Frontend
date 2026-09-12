Inventra-backend
Website which actually helps retailers !

📦 Inventory Management Backend

A robust backend system for managing inventory with automated database triggers and email notifications. This project is built to handle inventory operations efficiently while keeping users informed in real-time.

🚀 Features 📊 Inventory management (Add, Update, Delete items) 🔔 Automated email notifications to users ⚙️ MySQL triggers for event-based actions 🔐 Backend API for handling business logic 📈 Scalable and modular architecture 🛠️ Tech Stack Backend: Node.js, Express.js Database: MySQL Email Service: Nodemailer (or similar) Other: REST API, SQL Triggers ⚡ How It Works Inventory operations are performed via API endpoints MySQL triggers automatically execute on certain events (like insert/update) When a trigger fires, it helps initiate actions (like logging or notifications) Backend sends email updates to users based on changes 📂 Project Structure ├── controllers/ ├── routes/ ├── models/ ├── config/ ├── utils/ ├── server.js └── package.json 🧑‍💻 Installation & Setup 1️⃣ Clone the repository git clone https://github.com/your-username/your-repo.git cd your-repo 2️⃣ Install dependencies npm install 3️⃣ Setup environment variables

Create a .env file:

PORT=5000 DB_HOST=localhost DB_USER=root DB_PASSWORD=yourpassword DB_NAME=inventory_db EMAIL_USER=your-email@gmail.com EMAIL_PASS=your-email-password 4️⃣ Setup MySQL Database Create database: CREATE DATABASE inventory_db; Import your tables and triggers 5️⃣ Run the server npm start

Server will run on:

http://localhost:5000

📧 Email Notifications Sends email when: New item is added Item is updated Stock reaches a threshold (if implemented) ⚠️ Notes Ensure MySQL server is running Enable less secure apps or use app passwords for email Triggers must be properly configured in database 🌟 Future Improvements Add authentication (JWT) Add frontend dashboard Deploy on cloud (Railway / Render) Add analytics & reports 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.
