FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY enquiry_agent/ ${LAMBDA_TASK_ROOT}/enquiry_agent/

CMD ["enquiry_agent.handler.handler"]
