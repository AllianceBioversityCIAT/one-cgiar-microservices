# AWS Lambda Deployment Configuration

Este proyecto está configurado para poder ser desplegado en AWS Lambda. A continuación se describen los archivos y configuraciones necesarias:

## Archivos de configuración para Lambda

### 1. `src/lambda.ts`
Punto de entrada para AWS Lambda que adapta la aplicación NestJS para funcionar en el entorno serverless.

### 2. `template.yaml` 
Template de AWS SAM (Serverless Application Model) que define:
- Función Lambda
- API Gateway
- Roles IAM necesarios
- Variables de entorno

### 3. `webpack.config.js`
Configuración de Webpack para bundling optimizado para Lambda.

### 4. `samconfig.toml`
Configuración de parámetros para diferentes entornos (dev, prod).

### 5. `.samignore`
Lista de archivos a excluir del package de deployment.

## Dependencias agregadas

```json
{
  "@vendia/serverless-express": "^4.x.x",
  "aws-lambda": "^1.x.x",
  "@types/aws-lambda": "^8.x.x",
  "webpack": "^5.x.x",
  "webpack-cli": "^5.x.x",
  "webpack-node-externals": "^3.x.x"
}
```

## Variables de entorno requeridas

- `COGNITO_REGION`: Región de AWS Cognito
- `CLARISA_API_URL`: URL de la API de CLARISA
- `COGNITO_USER_POOL_ID`: ID del User Pool de Cognito
- `COGNITO_CLIENT_ID`: ID del cliente de Cognito

## Script de build

```bash
npm run build:lambda
```

Este comando genera el bundle optimizado en la carpeta `dist/` listo para deployment.

## Para DevOps

El proyecto incluye toda la configuración necesaria para deployment con AWS SAM CLI o cualquier herramienta de CI/CD que soporte CloudFormation templates.

Los archivos clave son:
- `template.yaml` - Infraestructura como código
- `samconfig.toml` - Configuración de parámetros
- `src/lambda.ts` - Handler de Lambda
- `webpack.config.js` - Configuración de build
