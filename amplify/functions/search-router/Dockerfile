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

# Accept build arguments for API keys
ARG COHERE_API_KEY
ARG GEMINI_API_KEY

# Set environment variables
ENV COHERE_API_KEY=${COHERE_API_KEY}
ENV GEMINI_API_KEY=${GEMINI_API_KEY}

# Copy requirements first for better caching
COPY src/requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY src/ ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD ["handler.handler"]