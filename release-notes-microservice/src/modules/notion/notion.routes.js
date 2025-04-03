const express = require('express');
const router = express.Router();
const notionController = require('./controllers/notion.controller');

// Database routes
router.get('/databases/:databaseId/query', notionController.queryDatabase);

// Page routes
router.get('/pages/:pageId', notionController.getPage);

// Block routes
router.get('/blocks/:blockId/children', notionController.getBlockChildren);

module.exports = router; 