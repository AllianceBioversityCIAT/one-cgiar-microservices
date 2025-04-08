const axios = require('axios');
const NotionService = require('../notion.service');
const notionConfig = require('../../../../config/notion.config');

// Mock axios
jest.mock('axios');

describe('NotionService', () => {
    let mockAxiosInstance;
    let notionService;

    beforeEach(() => {
    // Clear all mocks before each test
        jest.clearAllMocks();

        // Create a mock axios instance
        mockAxiosInstance = {
            post: jest.fn(),
            get: jest.fn()
        };

        // Mock axios.create to return our mock instance
        axios.create.mockReturnValue(mockAxiosInstance);

        // Create a new instance of NotionService for each test
        notionService = new NotionService();
    });

    describe('queryDatabase', () => {
        it('should query the database with project filters', async () => {
            // Mock data
            const databaseId = 'test-database-id';
            const projects = 'project1,project2';
            const mockResponse = { data: { results: [] } };

            // Mock axios post method
            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            // Call the method
            const result = await notionService.queryDatabase(databaseId, projects);

            // Assertions
            expect(result).toEqual(mockResponse.data);
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: notionConfig.baseUrl,
                headers: notionConfig.headers
            });
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                `/databases/${databaseId}/query`,
                {
                    filter: {
                        or: [
                            {
                                property: 'Projects',
                                multi_select: {
                                    contains: 'project1'
                                }
                            },
                            {
                                property: 'Projects',
                                multi_select: {
                                    contains: 'project2'
                                }
                            }
                        ]
                    }
                }
            );
        });

        it('should handle errors when querying the database', async () => {
            // Mock data
            const databaseId = 'test-database-id';
            const projects = 'project1';
            const errorMessage = 'Network error';

            // Mock axios post method to throw an error
            mockAxiosInstance.post.mockRejectedValue(new Error(errorMessage));

            // Call the method and expect it to throw
            await expect(notionService.queryDatabase(databaseId, projects))
                .rejects
                .toThrow(`Error querying database: ${errorMessage}`);
        });
    });

    describe('getPage', () => {
        it('should get a page by ID', async () => {
            // Mock data
            const pageId = 'test-page-id';
            const mockResponse = { data: { id: pageId } };

            // Mock axios get method
            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            // Call the method
            const result = await notionService.getPage(pageId);

            // Assertions
            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/pages/${pageId}`);
        });

        it('should handle 400 error when getting a page', async () => {
            // Mock data
            const pageId = 'test-page-id';
            const errorResponse = new Error();
            errorResponse.response = {
                status: 400
            };

            // Mock axios get method to throw an error
            mockAxiosInstance.get.mockRejectedValue(errorResponse);

            // Call the method
            const result = await notionService.getPage(pageId);

            // Assertions
            expect(result).toEqual({
                error: true,
                status: 400,
                message: 'Bad request while getting page'
            });
        });

        it('should handle 404 error when getting a page', async () => {
            // Mock data
            const pageId = 'test-page-id';
            const errorResponse = new Error();
            errorResponse.response = {
                status: 404
            };

            // Mock axios get method to throw an error
            mockAxiosInstance.get.mockRejectedValue(errorResponse);

            // Call the method
            const result = await notionService.getPage(pageId);

            // Assertions
            expect(result).toEqual({
                error: true,
                status: 404,
                message: 'Page not found'
            });
        });

        it('should handle 500 error when getting a page', async () => {
            // Mock data
            const pageId = 'test-page-id';
            const errorResponse = new Error();
            errorResponse.response = {
                status: 500
            };

            // Mock axios get method to throw an error
            mockAxiosInstance.get.mockRejectedValue(errorResponse);

            // Call the method
            const result = await notionService.getPage(pageId);

            // Assertions
            expect(result).toEqual({
                error: true,
                status: 500,
                message: 'Internal server error while getting page'
            });
        });
    
        it('should handle 403 error when getting a page', async () => {
            // Mock data
            const pageId = 'test-page-id';
            const errorResponse = new Error();
            errorResponse.response = {
                status: 403
            };

            // Mock axios get method to throw an error
            mockAxiosInstance.get.mockRejectedValue(errorResponse);

            // Call the method
            const result = await notionService.getPage(pageId);

            // Assertions
            expect(result).toEqual({
                error: true,
                status: 403,
                message: ''
            });
        });

        it('should handle other errors when getting a page', async () => {
            // Mock data
            const pageId = 'test-page-id';
            const errorResponse = new Error();
            errorResponse.response = {
                status: 403,
                message: 'Forbidden'
            };

            // Mock axios get method to throw an error
            mockAxiosInstance.get.mockRejectedValue(errorResponse);

            // Call the method
            const result = await notionService.getPage(pageId);

            // Assertions
            expect(result).toEqual({
                error: true,
                status: 403,
                message: 'Forbidden'
            });
        });
    });

    describe('getBlockChildren', () => {
        it('should get block children by ID', async () => {
            // Mock data
            const blockId = 'test-block-id';
            const mockResponse = { data: { results: [] } };

            // Mock axios get method
            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            // Call the method
            const result = await notionService.getBlockChildren(blockId);

            // Assertions
            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/blocks/${blockId}/children`);
        });

        it('should handle errors when getting block children', async () => {
            // Mock data
            const blockId = 'test-block-id';
            const errorMessage = 'Network error';

            // Mock axios get method to throw an error
            mockAxiosInstance.get.mockRejectedValue(new Error(errorMessage));

            // Call the method and expect it to throw
            await expect(notionService.getBlockChildren(blockId))
                .rejects
                .toThrow(`Error getting block children: ${errorMessage}`);
        });
    });
}); 