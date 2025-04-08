const express = require('express');
const router = express.Router();
const NotionController = require('./controllers/notion.controller');

// Create an instance of the controller
const notionController = new NotionController();

// Database routes
router.get('/databases/:databaseId/query', notionController.queryDatabase.bind(notionController));

// Page routes
router.get('/pages/:pageId', notionController.getPage.bind(notionController));

// Block routes
router.get('/blocks/:blockId/children', notionController.getBlockChildren.bind(notionController));

// Export the router
module.exports = router; 