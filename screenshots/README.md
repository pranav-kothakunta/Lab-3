# Screenshots Directory

Save all your Postman test and execution screenshots in this directory.

Recommended screenshot filenames to match `README.md`:

1. `server-start.png` - Terminal showing `Server is running at http://localhost:3000/` and database initialization
2. `get-all-books.png` - Postman: GET `http://localhost:3000/books` (HTTP 200)
3. `get-books-search.png` - Postman: GET `http://localhost:3000/books?search_q=JavaScript` (HTTP 200)
4. `get-books-order-asc.png` - Postman: GET `http://localhost:3000/books?order_by=price&order=ASC` (HTTP 200)
5. `get-books-order-desc.png` - Postman: GET `http://localhost:3000/books?order_by=price&order=DESC` (HTTP 200)
6. `get-books-pagination.png` - Postman: GET `http://localhost:3000/books?limit=2&offset=2` (HTTP 200)
7. `get-books-price-filter.png` - Postman: GET `http://localhost:3000/books?min_price=400&max_price=700` (HTTP 200)
8. `get-books-combined.png` - Postman: GET `http://localhost:3000/books?search_q=js&order_by=price&order=DESC&limit=5&offset=0&min_price=100&max_price=1000` (HTTP 200)
9. `get-single-book-success.png` - Postman: GET `http://localhost:3000/books/1` (HTTP 200)
10. `get-single-book-not-found.png` - Postman: GET `http://localhost:3000/books/999` (HTTP 404)
11. `post-book-success.png` - Postman: POST `http://localhost:3000/books` with valid JSON body (HTTP 201)
12. `post-book-validation-error.png` - Postman: POST `http://localhost:3000/books` with missing/empty title or price (HTTP 400)
13. `put-book-success.png` - Postman: PUT `http://localhost:3000/books/1` with updated JSON (HTTP 200)
14. `put-book-not-found.png` - Postman: PUT `http://localhost:3000/books/999` (HTTP 404)
15. `delete-book-success.png` - Postman: DELETE `http://localhost:3000/books/1` (HTTP 200)
16. `delete-book-not-found.png` - Postman: DELETE `http://localhost:3000/books/999` (HTTP 404)
