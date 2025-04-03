require('dotenv').config();

const notionConfig = {
    apiKey: process.env.NOTION_API_KEY,
    baseUrl: 'https://api.notion.com/v1',
    headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }
};

module.exports = notionConfig; 