const axios = require('axios');
const notionConfig = require('../../../config/notion.config');

class NotionService {
    constructor() {
        this.axiosInstance = axios.create({
            baseURL: notionConfig.baseUrl,
            headers: notionConfig.headers
        });
    }

    async queryDatabase(databaseId, projects) {
        try {
            const projectFilters = projects.split(',').map(project => ({
                property: "Projects",
                multi_select: {
                    contains: project.trim()
                }
            }));

            const filterBody = {
                filter: {
                    or: projectFilters
                }
            };

            const response = await this.axiosInstance.post(`/databases/${databaseId}/query`, filterBody);
            return response.data;
        } catch (error) {
            throw new Error(`Error querying database: ${error.message}`);
        }
    }

    async getPage(pageId) {
        try {
            const response = await this.axiosInstance.get(`/pages/${pageId}`);
            return response.data;
        } catch (error) {
            switch (error.response.status) {
                case 400:
                    return {
                        error: true,
                        status: 400,
                        message: "Bad request while getting page"
                    }
                case 404:
                    return {
                        error: true,
                        status: 404,
                        message: "Page not found"
                    }
                case 500:
                    return {
                        error: true,
                        status: 500,
                        message: "Internal server error while getting page"
                    }
                default:
                    return {
                        error: true,
                        status: error.response.status,
                        message: error.message
                    }
            }
        }
    }

    async getBlockChildren(blockId) {
        try {
            const response = await this.axiosInstance.get(`/blocks/${blockId}/children`);
            return response.data;
        } catch (error) {
            throw new Error(`Error getting block children: ${error.message}`);
        }
    }
}

module.exports = new NotionService(); 