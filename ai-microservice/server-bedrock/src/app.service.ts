import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CGIAR Text Mining API</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          background-color: #f4f4f9;
          color: #333;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }

        h1 {
          font-size: 2.5em;
          color: #2c3e50;
          margin-bottom: 0.5em;
          text-align: center;
        }

        p {
          font-size: 1.2em;
          color: #34495e;
          line-height: 1.6;
          text-align: center;
        }

        .container {
          background: #ffffff;
          padding: 2em;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to the ONE CGIAR Text Mining API</h1>
        <p>This API allows you to perform various text mining operations with AI.</p>
      </div>
    </body>
    </html>
    `;
  }
}
