import { Router, Request, Response } from 'express';
import { listEnquiries, getEnquiryById, createEnquiry, updateEnquiry } from './controller';
import { requireApiKey } from './auth';

const router = Router();

router.use(requireApiKey);

router.get('/', async (_req: Request, res: Response) => {
  const enquiries = await listEnquiries();
  res.json(enquiries);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const enquiry = await getEnquiryById(id);
  if (!enquiry) {
    res.status(404).json({ error: 'Enquiry not found' });
    return;
  }
  res.json(enquiry);
});

router.post('/', async (req: Request, res: Response) => {
  const result = await createEnquiry(req.body);
  if ('error' in result) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result.enquiry);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await updateEnquiry(id, req.body);
  if ('error' in result) {
    const status = result.error === 'Enquiry not found' ? 404 : 400;
    res.status(status).json(result);
    return;
  }
  res.json(result.enquiry);
});

export default router;
