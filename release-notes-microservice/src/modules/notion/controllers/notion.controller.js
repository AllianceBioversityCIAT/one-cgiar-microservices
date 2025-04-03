const notionService = require('../services/notion.service');

class NotionController {
    async queryDatabase(req, res) {
        try {
            const { databaseId } = req.params;
            const { projects } = req.query;

            if (!projects) {
                return res.status(400).json({ error: 'Projects query parameter is required' });
            }

            const data = await notionService.queryDatabase(databaseId, projects);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPage(req, res) {
        try {
            const { pageId } = req.params;
            const data = await notionService.getPage(pageId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getBlockChildren(req, res) {
        try {
            const { blockId } = req.params;
            const data = await notionService.getBlockChildren(blockId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new NotionController(); 