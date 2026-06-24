FROM node:20-alpine

WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install npm packages
RUN npm install

# Copy project files
COPY . .

EXPOSE 5173

# Bind to 0.0.0.0 for external access
CMD ["npm", "run", "dev", "--", "--host"]
