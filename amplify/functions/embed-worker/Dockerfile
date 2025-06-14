FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for compilation
RUN dnf update -y && \
    dnf install -y \
    gcc \
    gcc-c++ \
    make \
    cmake \
    git \
    && dnf clean all

# Copy requirements first for better caching
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY src/ ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD ["handler.lambda_handler"]