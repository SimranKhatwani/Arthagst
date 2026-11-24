import express from 'express';
import * as expenseController from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Category routes
router.post('/categories', expenseController.createCategory);
router.get('/categories', expenseController.getCategories);
router.get('/categories/:id', expenseController.getCategoryById);
router.put('/categories/:id', expenseController.updateCategory);
router.delete('/categories/:id', expenseController.deleteCategory);

// Expense routes
router.post('/', expenseController.createExpense);
router.get('/', expenseController.getExpenses);
router.get('/:id', expenseController.getExpenseById);
router.post('/:id/cancel', expenseController.cancelExpense);

export default router;
