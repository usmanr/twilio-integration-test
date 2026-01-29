import { Request, Response, NextFunction } from "express";

/**
 * Middleware to convert all keys in req.body to lowercase.
 * This allows for case-insensitive access in controllers.
 */
export const lowercaseBodyKeys = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    const newBody: { [key: string]: any } = {};
    for (const key in req.body) {
      newBody[key.toLowerCase()] = req.body[key];
    }
    req.body = newBody;
  }
  next();
};