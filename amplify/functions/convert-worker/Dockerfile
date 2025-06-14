FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.12

# Install system dependencies for PyMuPDF, pdf2image and PIL
RUN dnf update -y && \
    dnf install -y \
    gcc \
    gcc-c++ \
    make \
    poppler-utils \
    poppler-cpp-devel \
    libjpeg-turbo-devel \
    zlib-devel \
    freetype-devel \
    lcms2-devel \
    libwebp-devel \
    tcl-devel \
    tk-devel \
    && dnf clean all

# Copy requirements first for better layer caching
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt --target ${LAMBDA_TASK_ROOT}

# Copy function code
COPY src/handler.py ${LAMBDA_TASK_ROOT}

# Ensure the handler file is executable
RUN chmod 755 ${LAMBDA_TASK_ROOT}/handler.py

# Set the CMD to your handler
CMD ["handler.handler"]