from PIL import Image

# Open the image
img = Image.open('app-icon.png')
width, height = img.size

# Determine the new dimension (the maximum of the two)
new_dim = max(width, height)

# Create a new image with a transparent background
new_img = Image.new('RGBA', (new_dim, new_dim), (0, 0, 0, 0))

# Calculate the coordinates to paste the original image so it's centered
x = (new_dim - width) // 2
y = (new_dim - height) // 2

# Paste the original image onto the new image
new_img.paste(img, (x, y))

# Save the new square image
new_img.save('app-icon-square.png')
print("Saved square image.")
