# Notion2Sheets

## Overview

This is a Node.js project designed to fetch data from a Notion database and update or append the data to a Google Sheets document. It uses the Notion and Google Sheets APIs to perform these actions.

## Features

1. Fetch data from Notion databases.
2. Update or append rows to a Google Sheets document based on the data received from Notion.

## How to Use

### Prerequisites

- Node.js installed on your machine.
- A Notion account and a database from which data will be fetched.
- A Google account and a Google Sheets document to which the data will be written.
- Google Service Account with the necessary permissions to edit the Google Sheets document.
- Notion internal integration token.

### Setup
1. Clone the repository.

```bash
$ git clone https://github.com/caiotarifa/notion2sheets.git
````

2. Install the dependencies.

```bash
$ cd notion2sheets
$ npm install
```

3. Rename `.env.example` to `.env` and replace the placeholder text with your Google Service Account and Notion internal integration token.

```makefile
GOOGLE_SERVICE_ACCOUNT=your-google-service-account
NOTION_TOKEN=your-notion-token
```

4. Rename `collections.toml.example` file to `collections.toml` and replace the collections array with your own data.

```toml
[[collections]]
notionDatabaseId = "your-notion-database-id"
googleSheetId = "your-google-sheet-id"
googleSheetName = "your-google-sheet-name"
```

5. Run the script.

```bash
$ node main.js
```

The script will fetch data from the specified Notion database and update or append the data to the specified Google Sheets document.

## Contributing

Contributions to the project are welcome. If you want to contribute to the project, follow these steps:

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/feature-name`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/feature-name`).
5. Open a pull request.
6. Please make sure to update tests as appropriate.

## License

Distributed under the MIT License. See LICENSE for more information.
