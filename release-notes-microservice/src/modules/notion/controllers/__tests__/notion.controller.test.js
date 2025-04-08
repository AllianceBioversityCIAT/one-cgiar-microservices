const NotionController = require('../notion.controller');
const NotionService = require('../../services/notion.service');

// Mock the notion service
jest.mock('../../services/notion.service');

describe('NotionController', () => {
    let mockReq;
    let mockRes;
    let notionController;
    let mockNotionService;

    beforeEach(() => {
    // Reset mocks before each test
        jest.clearAllMocks();

        // Setup mock request, response, and next function
        mockReq = {
            params: {},
            query: {}
        };
        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };

        // Create mock instance of NotionService
        mockNotionService = {
            queryDatabase: jest.fn(),
            getPage: jest.fn(),
            getBlockChildren: jest.fn()
        };

        // Mock the constructor to return our mock service
        NotionService.mockImplementation(() => mockNotionService);

        // Create a new instance of NotionController for each test
        notionController = new NotionController();
    });

    describe('queryDatabase', () => {
        it('should return 400 if projects parameter is missing', async () => {
            // Call the method
            await notionController.queryDatabase(mockReq, mockRes);

            // Assertions
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Projects query parameter is required' });
        });

        it('should call notionService.queryDatabase and return the result', async () => {
            // Mock data
            mockReq.params.databaseId = 'test-database-id';
            mockReq.query.projects = 'project1,project2';
            const mockData = { results: [] };

            // Mock the service method
            mockNotionService.queryDatabase.mockResolvedValue(mockData);

            // Call the method
            await notionController.queryDatabase(mockReq, mockRes);

            // Assertions
            expect(mockNotionService.queryDatabase).toHaveBeenCalledWith('test-database-id', 'project1,project2');
            expect(mockRes.json).toHaveBeenCalledWith(mockData);
        });

        it('should handle errors from notionService.queryDatabase', async () => {
            // Mock data
            mockReq.params.databaseId = 'test-database-id';
            mockReq.query.projects = 'project1';
            const errorMessage = 'Error querying database';

            // Mock the service method to throw an error
            mockNotionService.queryDatabase.mockRejectedValue(new Error(errorMessage));

            // Call the method
            await notionController.queryDatabase(mockReq, mockRes);

            // Assertions
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: errorMessage });
        });
    });

    describe('getPage', () => {
        it('should call notionService.getPage and return the result', async () => {
            // Mock data
            mockReq.params.pageId = 'test-page-id';
            const mockData = { id: 'test-page-id' };

            // Mock the service method
            mockNotionService.getPage.mockResolvedValue(mockData);

            // Call the method
            await notionController.getPage(mockReq, mockRes);

            // Assertions
            expect(mockNotionService.getPage).toHaveBeenCalledWith('test-page-id');
            expect(mockRes.json).toHaveBeenCalledWith(mockData);
        });

        it('should handle errors from notionService.getPage', async () => {
            // Mock data
            mockReq.params.pageId = 'test-page-id';
            const errorMessage = 'Error getting page';

            // Mock the service method to throw an error
            mockNotionService.getPage.mockRejectedValue(new Error(errorMessage));

            // Call the method
            await notionController.getPage(mockReq, mockRes);

            // Assertions
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: errorMessage });
        });
    });

    describe('getBlockChildren', () => {
        it('should call notionService.getBlockChildren and return the result', async () => {
            // Mock data
            mockReq.params.blockId = 'test-block-id';
            const mockData = { results: [] };

            // Mock the service method
            mockNotionService.getBlockChildren.mockResolvedValue(mockData);

            // Call the method
            await notionController.getBlockChildren(mockReq, mockRes);

            // Assertions
            expect(mockNotionService.getBlockChildren).toHaveBeenCalledWith('test-block-id');
            expect(mockRes.json).toHaveBeenCalledWith(mockData);
        });

        it('should handle errors from notionService.getBlockChildren', async () => {
            // Mock data
            mockReq.params.blockId = 'test-block-id';
            const errorMessage = 'Error getting block children';

            // Mock the service method to throw an error
            mockNotionService.getBlockChildren.mockRejectedValue(new Error(errorMessage));

            // Call the method
            await notionController.getBlockChildren(mockReq, mockRes);

            // Assertions
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: errorMessage });
        });
    });
}); 