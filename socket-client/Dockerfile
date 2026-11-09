# ১. বেস ইমেজ
FROM node:20-alpine

# ২. ওয়ার্কিং ডিরেক্টরি
WORKDIR /app

# ৩. প্যাকেজ ফাইল কপি এবং ইনস্টল
COPY package*.json ./
RUN npm install

# ৪. বাকি কোড কপি করা
COPY . .

# ৫. Next.js অ্যাপ বিল্ড করা (প্রোডাকশনের জন্য জরুরি)
RUN npm run build

# ৬. পোর্ট এক্সপোজ করা (Next.js ডিফল্ট ৩০০০)
EXPOSE 3000

# ৭. অ্যাপ রান করা
CMD ["npm", "start"]