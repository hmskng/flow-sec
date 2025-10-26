# Secure Messenger Backend

## Setup

1. Copy `.env.example` to `.env` and fill in your MongoDB URI and Gmail credentials.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the server:
   ```sh
   npm start
   ```

## API Endpoints

- `POST /api/register` — multipart/form-data with `email`, `username`, `password`, optional `icon` and `publicKey`. Creates a new account (password is required).
- `POST /api/login` — `{ email, password }` in JSON body. Returns the user on success.

## Notes
- Authentication is password-based. OTP/email verification has been removed.
