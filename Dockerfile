FROM node:20.18.1-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the entire project to the working directory
COPY . .

# Expose the port that the Next.js app will run on
EXPOSE 4000

# Command to start the Next.js app
CMD ["node", "server.js"]