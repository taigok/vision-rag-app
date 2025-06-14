import { LayerVersion, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let sharedLayer: LayerVersion | null = null;

export function createPythonDepsLayer(scope: Construct): LayerVersion {
  if (!sharedLayer) {
    sharedLayer = new LayerVersion(scope, 'PythonDepsLayer', {
      layerVersionName: 'python-deps',
      code: Code.fromAsset(join(__dirname, 'python-deps.zip')),
      compatibleRuntimes: [Runtime.PYTHON_3_12],
    });
  }
  return sharedLayer;
}