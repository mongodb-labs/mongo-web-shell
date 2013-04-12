def parse_arguments(arguments):
    """
    Parses the arguments from the query from the console.
    
    The arguments received from the front end are comma separated and each
    arguement is of the 'key:value' form. This function converts that into
    a dictionary of arguments.
    """
    parsed_arguments = {}
    arguments_list = arguments.split(",")
    for argument in arguments_list:
        (key, value) = argument.split(":")
        # Key is always a string
        key = key
        print type(key)
        
        # If the value was expicitely received in quotes, it should be 
        # treated as a string. Otherwise, try to convert it to a number.
        if (value[0] == '"' or value[0] == "'" ):
            value = value[1:-1]
        else:
            value = try_number(value)
        
        parsed_arguments[key] = value
        
    return parsed_arguments

def try_number(input):
    """
    Tries to convert a string to a number or a float. If not, returns string.
    
    The function first tries to convert the number to integer, if not then
    tries to convert it a float. Otherwise, returns the string itself.
    
    TODO: Ideally, we should never get an unquoted string as a value and it
    should be handled on the front end itself.
    """
    if input.isdigit():
        return int(input)
    try:
        input = float(input)
        return input
    except ValueError:
        return input
