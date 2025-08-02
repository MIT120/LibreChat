# 🔄 Book Creation MCP Server Restart Guide

## ⚡ Quick Fix for Timeout Issues

The timeout error you're experiencing requires **restarting the MCP server** to pick up the new database connection improvements.

## 🚀 How to Restart the MCP Server

### Method 1: Full LibreChat Restart (Recommended)
```bash
# Stop LibreChat completely
docker-compose down

# Start it back up
docker-compose up -d
```

### Method 2: Restart Just the API Service
```bash
# Restart just the API container (which runs the MCP server)
docker-compose restart api
```

### Method 3: Check Server Logs (For Debugging)
```bash
# View the logs to see if the server restarted properly
docker-compose logs -f api
```

## ✅ What the Fix Does

The improvements I made will:

1. **Fix Database Timeouts**: 
   - Disabled mongoose buffering (`bufferCommands: false`)
   - Added proper connection timeouts (15s-45s ranges)
   - Optimized queries with `maxTimeMS()` timeouts

2. **Optimize Performance**:
   - Bulk queries instead of sequential ones
   - Using `lean()` for faster object returns
   - Better connection pooling

3. **Better Error Handling**:
   - Specific timeout messages
   - Helpful troubleshooting tips
   - Graceful degradation

## 🔍 Verify the Fix

After restarting, try exporting your book again. You should see:

✅ **Success Indicators:**
- Much faster response times
- Detailed progress logs in console
- Proper download links in chat
- No more "buffering timed out" errors

❌ **If Still Having Issues:**
- Check Docker logs: `docker-compose logs api`
- Verify MongoDB is running: `docker-compose ps`
- Try a smaller book first to test

## 📊 What Changed

### Before:
- Default mongoose buffering (10s timeout)
- Sequential database queries
- Basic error messages
- Connection issues with large books

### After:
- Disabled buffering + custom timeouts (15-45s)
- Optimized bulk queries
- Detailed error messages with troubleshooting
- Robust connection handling

## 🆘 Troubleshooting

### If restart doesn't work:
1. **Check MongoDB**: `docker-compose ps mongodb`
2. **Clear Docker cache**: `docker-compose down -v && docker-compose up -d`
3. **Check disk space**: `df -h`
4. **View full logs**: `docker-compose logs --tail=50 api`

### Expected log output after restart:
```
🚀 Starting export for book [bookId] (format: pdf)
MongoDB connection established successfully
Book content loaded: X chapters, Y pages
📄 Created PDF file: book-title.pdf (123 KB)
✅ Export completed in 2.3s for book [bookId]
```

---

## 💡 Pro Tips

- **Large Books**: May take 30-60 seconds (now with proper timeouts)
- **Download Links**: Should work immediately in LibreChat chat
- **Monitoring**: Check logs if you want to see detailed progress

**Ready to test?** Just restart LibreChat and try the export again! 🎉