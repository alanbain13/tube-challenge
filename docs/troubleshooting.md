# Troubleshooting Guide

**Version:** 1.0  
**Date:** 29 August 2025  
**Purpose:** User-facing solutions for common problems and issues.

**Related Documents:**
- **[Known Issues](./known-issues.md)**: Current active bugs and development issues
- **[Bug Tracking Guide](./bug-tracking-guide.md)**: For reporting new problems
- **[Product Spec v0.2](./product-spec-v0.2.md)**: Current app features and expected behavior

---

## Quick Fixes

### App Won't Load
1. **Refresh the page** (Ctrl+F5 or Cmd+Shift+R)
2. **Clear browser cache** and cookies for the app
3. **Try a different browser** or incognito/private mode
4. **Check internet connection** and try again

### Can't Sign In
1. **Check email and password** are correct
2. **Clear browser cache** and cookies
3. **Try "Forgot Password"** to reset if needed
4. **Disable browser password manager** temporarily
5. **Check if using correct email address** (no typos)

### Camera Won't Open for Check-in
1. **Grant camera permissions** when prompted by browser
2. **Try "Use Photo Library"** as alternative option
3. **Refresh page and try again**
4. **Check browser camera permissions** in settings
5. **Use different browser** if camera still fails

---

## Common Issues by Feature

### Authentication Problems

#### "Invalid email or password"
- **Solution**: Double-check spelling and case sensitivity
- **Alternative**: Use "Forgot Password" to reset
- **Note**: Account creation and sign-in use the same email

#### Stuck on loading after sign-in
- **Solution**: Clear browser data and try again
- **Check**: Internet connection stability
- **Alternative**: Try incognito/private browsing mode

### Map Issues

#### Map appears blank or won't load
- **Solution**: Refresh page and wait for full load
- **Check**: Internet connection for map tiles
- **Alternative**: Try different zoom level or location

#### Stations not appearing on map
- **Solution**: Wait for data to load completely
- **Check**: Zoom level (zoom in to see individual stations)
- **Note**: Initial load may take a few seconds

### Check-in Problems

#### Photo upload fails
- **Solution**: Check internet connection and try again
- **Alternative**: Take photo with camera app and upload from gallery
- **Check**: Photo file size (very large photos may fail)

#### "Not near station" error
- **Solution**: Move closer to the station (within 750m)
- **Alternative**: Choose "Save as Pending" if you're certain you're at the station
- **Check**: GPS/location services are enabled in browser

#### Duplicate check-in message
- **Solution**: This is normal - you've already checked in at this station for this activity
- **Note**: Each station can only be visited once per activity

### Activity & Route Issues

#### Route won't save
- **Solution**: Ensure at least 2 stations are selected
- **Check**: Internet connection for saving to database
- **Alternative**: Try creating route again with fewer stations

#### Activity shows no progress
- **Solution**: Complete your first check-in to see activity start
- **Check**: Ensure you started the activity before checking in
- **Note**: Unplanned activities start automatically with first check-in

---

## Browser-Specific Issues

### iOS Safari
- **Camera issues**: Grant camera permissions, try landscape orientation
- **Touch problems**: Use firm taps, avoid rapid tapping
- **Loading delays**: Wait for complete page load before interacting

### Chrome Mobile
- **Location accuracy**: Enable high-accuracy location in Chrome settings
- **Photo upload**: Use "Take Photo" option for better results
- **Performance**: Close other tabs if app runs slowly

### Desktop Browsers
- **Map navigation**: Use mouse wheel for zoom, drag to pan
- **Photo upload**: Use "Choose File" option to upload existing photos
- **Screen size**: Ensure browser window is wide enough for proper layout

---

## Performance Issues

### App Runs Slowly
1. **Close other browser tabs** to free memory
2. **Restart browser** to clear temporary files
3. **Check internet speed** - slow connections affect performance
4. **Try different device** if available

### Images Take Long to Load
1. **Check internet connection** speed and stability
2. **Wait for complete upload** before navigating away
3. **Use smaller photo files** when possible
4. **Try uploading one photo at a time**

---

## Network & Connectivity

### Offline Mode
- **Behavior**: Check-ins are saved locally when offline
- **Sync**: Data automatically syncs when connection returns
- **Status**: "Pending sync" appears until online sync completes

### Slow Internet Connection
- **Maps**: May load slowly or appear blank initially
- **Photos**: Upload may take longer or fail
- **Solution**: Wait for stable connection or try later

---

## Error Messages Explained

### "Already checked in to [Station] for this activity"
- **Meaning**: You've already visited this station in your current activity
- **Action**: No action needed - this prevents duplicate entries
- **Note**: You can visit the same station in different activities

### "You're offline. Your check-in is saved as pending and will sync automatically."
- **Meaning**: No internet connection, but check-in is saved locally
- **Action**: Continue using app - data will sync when online
- **Note**: Pending check-ins show in your activity until synced

### "We couldn't confirm you're near [Station]. Save as pending or retake a photo near the station."
- **Meaning**: GPS location doesn't match station location
- **Options**: Move closer to station or save as pending for later verification
- **Note**: 750m tolerance for large stations

---

## When to Report a Bug

Report issues that are **not** covered in this guide:

### Definitely Report:
- App crashes or becomes completely unusable
- Data loss or corruption
- Features that don't work at all
- Security concerns

### Consider Reporting:
- Persistent problems not solved by troubleshooting steps
- Features that work inconsistently
- Significant performance issues
- Confusing user interface elements

### How to Report:
1. **Check [Known Issues](./known-issues.md)** first
2. **Follow [Bug Tracking Guide](./bug-tracking-guide.md)** process
3. **Include details**: device, browser, steps to reproduce
4. **Describe impact**: how it affects your use of the app

---

## Getting Additional Help

### For Development Issues:
- Check [Known Issues](./known-issues.md) for current bugs
- Review [Bug Tracking Guide](./bug-tracking-guide.md) for reporting process
- Reference [Product Spec v0.2](./product-spec-v0.2.md) for expected behavior

### For Feature Questions:
- Review [Product Vision Backlog](./product-vision-backlog.md) for planned features
- Check [Product Spec v0.1](./product-spec.md) for comprehensive feature overview

### Emergency Issues:
- App security concerns: Report immediately using bug tracking process
- Data loss: Report as Critical severity issue
- Account access problems: Try troubleshooting steps first, then report

---

**Last Updated:** 29 August 2025  
**Next Review:** Monthly updates based on common support requests and bug patterns