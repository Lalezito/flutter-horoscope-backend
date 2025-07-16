# Flutter Horoscope Backend

This project is a basic backend built with Node.js and Express that connects a Flutter app to a PostgreSQL database hosted on Railway. 

## Features

- Connects to PostgreSQL using the `DATABASE_URL` environment variable.
- Provides two API endpoints:
  - `GET /api/coaching`: Retrieves a daily horoscope based on query parameters.
  - `POST /api/coaching/notify`: Receives horoscope data and logs it to the console.
- CORS is enabled to allow requests from the Flutter app.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node package manager)
- PostgreSQL database hosted on Railway
- An account on Railway

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd flutter-horoscope-backend
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and set the `DATABASE_URL` variable. You can use the `.env.example` file as a reference.

### Running the Application

To run the application in development mode, use the following command:

```bash
npm run dev
```

This will start the server and watch for changes.

### Deploying on Railway

1. Push your code to a GitHub repository.
2. Go to [Railway](https://railway.app/) and create a new project.
3. Connect your GitHub repository to Railway.
4. Set the `DATABASE_URL` environment variable in the Railway dashboard.
5. Deploy the project.

## Scripts

- `dev`: Starts the application in development mode.
- `start`: Starts the application in production mode.

## License

This project is licensed under the MIT License.