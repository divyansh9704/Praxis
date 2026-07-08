from PIL import Image

img = Image.open('app-icon.png').convert("RGBA")
width, height = img.size

# Let's crop the top part. Based on the image, the text "PRAXIS" starts around 70-75% down.
# Let's just take the top 75%.
crop_box = (0, 0, width, int(height * 0.70))
cropped = img.crop(crop_box)

# Now find the bounding box of the non-transparent/non-black pixels in the cropped area
bbox = cropped.getbbox()
if bbox:
    cropped = cropped.crop(bbox)

# Now make it a perfect square by padding with transparent pixels
c_width, c_height = cropped.size
new_dim = max(c_width, c_height)

# Give it a 10% padding so it looks good as an icon
pad = int(new_dim * 0.1)
final_dim = new_dim + (pad * 2)

new_img = Image.new('RGBA', (final_dim, final_dim), (0, 0, 0, 0))
x = (final_dim - c_width) // 2
y = (final_dim - c_height) // 2
new_img.paste(cropped, (x, y))

# Save the extracted logo
out_path = r'C:\Users\Divyansh Sharma\.gemini\antigravity\brain\3545e058-70e7-4271-9584-ea529077fd99\extracted_logo.png'
new_img.save(out_path)
new_img.save('app-icon-extracted.png')
print("Saved extracted logo to artifacts")
